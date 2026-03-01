const { YouTubeTranscriptApi } = require('yt-transcript-api');

function parseChannelUrl(url) {
  const s = String(url).trim();
  const channelIdMatch = s.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/);
  if (channelIdMatch) return { type: 'channelId', value: channelIdMatch[1] };
  const handleMatch = s.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  const userMatch = s.match(/youtube\.com\/user\/([A-Za-z0-9_-]+)/);
  if (userMatch) return { type: 'username', value: userMatch[1] };
  return null;
}

async function getChannelIdFromHandleOrUsername(apiKey, handleOrUsername, type) {
  const base = 'https://www.googleapis.com/youtube/v3';
  if (type === 'handle') {
    const url = `${base}/channels?part=id&forHandle=@${handleOrUsername}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items[0]) return data.items[0].id;
    const searchUrl = `${base}/search?part=snippet&type=channel&q=@${handleOrUsername}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.items && searchData.items[0] && searchData.items[0].id.channelId)
      return searchData.items[0].id.channelId;
  }
  if (type === 'username') {
    const url = `${base}/channels?part=id&forUsername=${handleOrUsername}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items[0]) return data.items[0].id;
  }
  return null;
}

async function getUploadsPlaylistId(apiKey, channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.items && data.items[0] && data.items[0].contentDetails && data.items[0].contentDetails.relatedPlaylists)
    return data.items[0].contentDetails.relatedPlaylists.uploads;
  return null;
}

async function getPlaylistVideoIds(apiKey, playlistId, maxResults) {
  const ids = [];
  let pageToken = '';
  const base = 'https://www.googleapis.com/youtube/v3/playlistItems';
  while (ids.length < maxResults) {
    const url = `${base}?part=snippet&playlistId=${playlistId}&maxResults=${Math.min(50, maxResults - ids.length)}${pageToken ? '&pageToken=' + pageToken : ''}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'YouTube API error');
    if (!data.items || !data.items.length) break;
    for (const item of data.items) {
      if (item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId) {
        ids.push(item.snippet.resourceId.videoId);
        if (ids.length >= maxResults) break;
      }
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return ids;
}

async function getVideoDetails(apiKey, videoIds) {
  if (videoIds.length === 0) return [];
  const base = 'https://www.googleapis.com/youtube/v3/videos';
  const ids = videoIds.slice(0, 50).join(',');
  const url = `${base}?part=snippet,contentDetails,statistics&id=${ids}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'YouTube API error');
  return data.items || [];
}

function parseDuration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Fetch channel video metadata (and optionally transcripts).
 * @param {string} apiKey - YouTube Data API v3 key
 * @param {string} channelUrl - e.g. https://www.youtube.com/@veritasium
 * @param {number} maxVideos - 1–100
 * @param {function} onProgress - (current, total, message) => void
 * @returns {Promise<Array>} array of video objects
 */
async function fetchChannelData(apiKey, channelUrl, maxVideos, onProgress = () => {}) {
  const parsed = parseChannelUrl(channelUrl);
  if (!parsed) throw new Error('Invalid channel URL');

  let channelId = parsed.type === 'channelId' ? parsed.value : null;
  if (!channelId) {
    channelId = await getChannelIdFromHandleOrUsername(apiKey, parsed.value, parsed.type);
    if (!channelId) throw new Error('Channel not found');
  }

  onProgress(0, maxVideos, 'Fetching video list...');
  const playlistId = await getUploadsPlaylistId(apiKey, channelId);
  if (!playlistId) throw new Error('Could not get uploads playlist');

  const videoIds = await getPlaylistVideoIds(apiKey, playlistId, maxVideos);
  if (videoIds.length === 0) return [];

  onProgress(0, videoIds.length, 'Fetching video details...');
  const details = await getVideoDetails(apiKey, videoIds);
  const results = [];

  for (let i = 0; i < details.length; i++) {
    const v = details[i];
    const vid = v.id;
    const snippet = v.snippet || {};
    const stat = v.statistics || {};
    const content = v.contentDetails || {};
    onProgress(i + 1, details.length, `Fetching transcript ${i + 1}/${details.length}: ${(snippet.title || '').slice(0, 40)}...`);
    let transcript = null;
    let transcriptError = null;
    try {
      const api = new YouTubeTranscriptApi();
      let fetched;
      try {
        fetched = await api.fetch(vid, ['en', 'en-US', 'en-GB']);
      } catch {
        const list = await api.list(vid);
        const first = [...list][0];
        fetched = first ? await first.fetch() : null;
      }
      transcript = fetched && Array.isArray(fetched) ? fetched.map((s) => s.text).join(' ') : null;
    } catch (err) {
      transcriptError = err.message || err.name || String(err);
    }
    results.push({
      videoId: vid,
      videoUrl: `https://www.youtube.com/watch?v=${vid}`,
      title: snippet.title || null,
      description: snippet.description || null,
      duration: parseDuration(content.duration) || content.duration || null,
      releaseDate: snippet.publishedAt || null,
      viewCount: stat.viewCount != null ? parseInt(stat.viewCount, 10) : null,
      likeCount: stat.likeCount != null ? parseInt(stat.likeCount, 10) : null,
      commentCount: stat.commentCount != null ? parseInt(stat.commentCount, 10) : null,
      transcript: transcript || null,
      transcriptError: transcriptError || null,
    });
  }
  return results;
}

module.exports = { fetchChannelData };
