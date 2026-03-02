/**
 * YouTube channel JSON tools: declarations for Gemini and client-side execution.
 * Channel data is an array of video objects with: videoId, videoUrl, title, description,
 * duration, releaseDate, viewCount, likeCount, commentCount, transcript.
 */

export const CHANNEL_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt. Optionally use an anchor/reference image (provided by the user) to guide style or content. Use when the user asks to create, generate, or draw an image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Detailed text description of the image to generate.',
        },
        anchorImageDescription: {
          type: 'STRING',
          description: 'Optional. Brief description of the anchor/reference image the user provided (e.g. "screenshot of a chart") to guide generation.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot a numeric metric (views, likes, comments, etc.) vs time for the loaded channel videos. Use when the user asks to plot, chart, or visualize a metric over time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metricField: {
          type: 'STRING',
          description:
            'The numeric field to plot. Must be one of: viewCount, likeCount, commentCount, or durationSeconds. Use the exact field name from the channel JSON.',
        },
      },
      required: ['metricField'],
    },
  },
  {
    name: 'play_video',
    description:
      'Open or play a YouTube video from the loaded channel data. Use when the user asks to "play", "open", or "watch" a video. Identify the video by title (e.g. "the asbestos video"), ordinal (e.g. "first video", "3rd video"), or "most viewed".',
    parameters: {
      type: 'OBJECT',
      properties: {
        which: {
          type: 'STRING',
          description:
            'Which video: a title fragment (e.g. "asbestos"), ordinal (e.g. "first", "second", "1", "3"), or "most viewed".',
        },
      },
      required: ['which'],
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute statistics (mean, median, std, min, max) for a numeric field in the loaded channel JSON. Use when the user asks for statistics, average, distribution, or summary of a numeric column (e.g. viewCount, likeCount, commentCount, duration).',
    parameters: {
      type: 'OBJECT',
      properties: {
        fieldName: {
          type: 'STRING',
          description:
            'Exact numeric field name from the channel data: viewCount, likeCount, commentCount, or durationSeconds.',
        },
      },
      required: ['fieldName'],
    },
  },
];

function parseDurationToSeconds(duration) {
  if (duration == null) return null;
  if (typeof duration === 'number' && !isNaN(duration)) return duration;
  const s = String(duration);
  const match = s.match(/^(?:(\d+):)?(?:(\d+):)?(\d+)$/);
  if (!match) return null;
  const [, h, m, sec] = match;
  const hours = h ? parseInt(h, 10) : 0;
  const mins = m ? parseInt(m, 10) : 0;
  const secs = parseInt(sec, 10);
  return hours * 3600 + mins * 60 + secs;
}

/** Pick value from either camelCase or snake_case for consistency. */
function pick(obj, camel, snake) {
  const v = obj[camel] ?? obj[snake];
  return v !== undefined && v !== null && v !== '' ? v : undefined;
}

/** Key metrics only — no transcript/description. Used for prompts and in-memory channel data. */
const CHANNEL_KEY_FIELDS = ['videoId', 'videoUrl', 'title', 'releaseDate', 'viewCount', 'likeCount', 'commentCount', 'durationSeconds'];

/** Ensure each video has canonical camelCase fields and durationSeconds. Keeps only key metrics (no transcript/description). */
export function normalizeChannelData(videos) {
  if (!Array.isArray(videos)) return [];
  return videos.map((v) => {
    const videoId = pick(v, 'videoId', 'video_id') || undefined;
    const title = pick(v, 'title', 'title') ?? '';
    const viewCount = pick(v, 'viewCount', 'view_count');
    const likeCount = pick(v, 'likeCount', 'like_count');
    const commentCount = pick(v, 'commentCount', 'comment_count');
    const releaseDate = pick(v, 'releaseDate', 'release_date') ?? pick(v, 'publishedAt', 'published_at');
    const duration = v.duration ?? v.durationSeconds;
    const out = {
      videoId,
      videoUrl: pick(v, 'videoUrl', 'video_url') || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined),
      title: title || (videoId ? `Video ${videoId}` : ''),
      releaseDate: releaseDate || undefined,
      viewCount: viewCount != null ? Number(viewCount) : undefined,
      likeCount: likeCount != null ? Number(likeCount) : undefined,
      commentCount: commentCount != null ? Number(commentCount) : undefined,
      durationSeconds: v.durationSeconds ?? parseDurationToSeconds(duration),
    };
    return out;
  });
}

/** Return a slim copy of videos for prompt context (key metrics only). */
export function slimChannelForPrompt(videos, maxSamples = 2) {
  if (!Array.isArray(videos)) return [];
  return videos.slice(0, maxSamples).map((v) => {
    const o = {};
    CHANNEL_KEY_FIELDS.forEach((k) => { if (v[k] !== undefined && v[k] !== null) o[k] = v[k]; });
    return o;
  });
}

/**
 * Execute a channel tool. Returns a result object; some include special keys for UI (_chartType, _imageResult, _playVideo).
 * @param {string} toolName
 * @param {object} args
 * @param {Array} channelData - Array of video objects from channel JSON (with durationSeconds normalized)
 * @param {function} generateImageFn - async (prompt, anchorImageBase64) => imageBase64 string
 */
export async function executeChannelTool(toolName, args, channelData, generateImageFn) {
  const videos = normalizeChannelData(Array.isArray(channelData) ? channelData : []);
  const numericFields = ['viewCount', 'likeCount', 'commentCount', 'durationSeconds'];

  switch (toolName) {
    case 'compute_stats_json': {
      const field = args.fieldName || 'viewCount';
      if (!numericFields.includes(field)) {
        return { error: `Unknown field "${field}". Use one of: ${numericFields.join(', ')}.` };
      }
      let values = videos.map((v) => v[field]).filter((n) => n != null && n !== '');
      if (field === 'duration' && values.length === 0) {
        values = videos.map((v) => parseDurationToSeconds(v.duration)).filter((n) => n != null);
      }
      if (field === 'durationSeconds' || field === 'duration') {
        values = videos.map((v) => v.durationSeconds ?? parseDurationToSeconds(v.duration)).filter((n) => n != null);
      }
      if (!values.length) return { error: `No numeric values for "${field}".` };
      const sorted = [...values].map(Number).sort((a, b) => a - b);
      const n = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      return {
        field: field,
        count: n,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        std: Math.round(std * 100) / 100,
        min: Math.min(...sorted),
        max: Math.max(...sorted),
      };
    }

    case 'plot_metric_vs_time': {
      const rawMetric = (args.metricField || 'viewCount').trim();
      const metricAliases = { likes: 'likeCount', views: 'viewCount', comments: 'commentCount', duration: 'durationSeconds' };
      const metricField = metricAliases[rawMetric.toLowerCase()] || rawMetric;
      if (!numericFields.includes(metricField)) {
        return { error: `Unknown metric "${rawMetric}". Use one of: viewCount, likeCount, commentCount, durationSeconds (or "views", "likes", "comments").` };
      }
      const data = videos
        .map((v) => {
          let value = v[metricField];
          if ((metricField === 'duration' || metricField === 'durationSeconds') && value == null)
            value = parseDurationToSeconds(v.duration);
          const date = v.releaseDate ? new Date(v.releaseDate).getTime() : null;
          if (value == null || date == null) return null;
          return { date: v.releaseDate, timestamp: date, value: Number(value), title: v.title || v.videoId };
        })
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);
      if (!data.length) return { error: `No data for "${metricField}" vs time.` };
      return {
        _chartType: 'metric_vs_time',
        metricField,
        data,
      };
    }

    case 'play_video': {
      const rawWhich = (args.which || args.video || '').trim();
      const which = rawWhich.toLowerCase();
      if (!which) return { error: 'Specify which video: title (e.g. "asbestos"), ordinal (e.g. "first", "3rd"), or "most viewed".' };
      let chosen = null;

      // "most viewed" and common variants
      if (/\bmost\s*viewed\b|highest\s*views|top\s*video\b/i.test(which) || which === 'most viewed' || which === 'most viewed video') {
        chosen = videos.length
          ? videos.reduce((best, v) => ((v.viewCount ?? 0) > (best.viewCount ?? 0) ? v : best))
          : null;
      } else {
        // Ordinal: "first", "the first video", "1st video", "1", etc.
        const ordMap = { first: 0, '1st': 0, '1': 0, second: 1, '2nd': 1, '2': 1, third: 2, '3rd': 2, '3': 2, fourth: 3, '4': 3, fifth: 4, '5': 4, sixth: 5, '6': 5, seventh: 6, '7': 6, eighth: 7, '8': 7, ninth: 8, '9': 8, tenth: 9, '10': 9 };
        const ordMatch = which.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|\d+)\b/);
        if (ordMatch) {
          const ordKey = ordMatch[1];
          const ord = ordMap[ordKey] ?? (parseInt(ordKey, 10) - 1);
          if (ord >= 0 && ord < videos.length) chosen = videos[ord];
        }
      }

      // Title search: strip "the", "video", "play", "open", "watch" and match remaining words
      if (!chosen) {
        const stopwords = /\b(the|video|videos|play|open|watch|please|want|see)\b/gi;
        const searchTerms = which.replace(stopwords, ' ').replace(/\s+/g, ' ').trim();
        const terms = searchTerms ? searchTerms.split(/\s+/).filter(Boolean) : [which];
        chosen = videos.find((v) => {
          const t = (v.title || '').toLowerCase();
          return terms.length && terms.every((term) => t.includes(term));
        }) || videos.find((v) => (v.title || '').toLowerCase().includes(which));
      }

      if (!chosen) return { error: `No video found for "${rawWhich}". Try by title (e.g. a word from the video name), ordinal (e.g. "first", "3rd"), or "most viewed".` };
      const vid = chosen.videoId;
      if (!vid) return { error: 'This video has no video ID; cannot open on YouTube.' };
      const videoUrl = chosen.videoUrl || `https://www.youtube.com/watch?v=${vid}`;
      const title = chosen.title || `Video ${vid}`;
      const thumbnailUrl = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
      return {
        _chartType: 'play_video',
        videoUrl,
        title,
        thumbnailUrl,
      };
    }

    case 'generateImage': {
      try {
        const anchorBase64 = args.anchorImageBase64 || null;
        const imageBase64 = await generateImageFn(args.prompt || '', anchorBase64);
        if (!imageBase64) return { error: 'Image generation failed.' };
        return { _imageResult: { dataUrl: `data:image/png;base64,${imageBase64}` } };
      } catch (e) {
        return { error: e.message || 'Image generation failed.' };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
