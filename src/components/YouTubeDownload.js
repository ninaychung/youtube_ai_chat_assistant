import { useState } from 'react';
import './YouTubeDownload.css';

const API = process.env.REACT_APP_API_URL || '';

export default function YouTubeDownload({ onLogout }) {
  const [channelUrl, setChannelUrl] = useState('https://www.youtube.com/@veritasium');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState(null);

  const handleDownload = async () => {
    setError('');
    setResultData(null);
    setLoading(true);
    setProgress({ current: 0, total: Math.min(100, Math.max(1, maxVideos)), message: 'Starting...' });

    try {
      const res = await fetch(`${API}/api/youtube/channel-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl: channelUrl.trim(),
          maxVideos: Math.min(100, Math.max(1, maxVideos)),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'progress') {
              setProgress({
                current: event.current,
                total: event.total,
                message: event.message || '',
              });
            } else if (event.type === 'done') {
              setResultData(event.data);
              setProgress((p) => ({ ...p, message: 'Complete!' }));
            } else if (event.type === 'error') {
              throw new Error(event.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === 'done') setResultData(event.data);
          else if (event.type === 'error') throw new Error(event.error);
        } catch (e) {
          if (e.message) setError(e.message);
        }
      }
    } catch (err) {
      setError(err.message || 'Download failed');
      setResultData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!resultData) return;
    const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-channel-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="youtube-download">
      <div className="youtube-download-card">
        <h1 className="youtube-download-title">YouTube Channel Data Download</h1>
        <p className="youtube-download-desc">
          Enter a YouTube channel URL to download metadata (title, description, transcript, duration, views, likes, comments) for its videos.
        </p>

        <label className="youtube-label">Channel URL</label>
        <input
          type="url"
          className="youtube-input"
          placeholder="https://www.youtube.com/@channelname"
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          disabled={loading}
        />

        <label className="youtube-label">Max videos (1–100)</label>
        <input
          type="number"
          className="youtube-input youtube-input-num"
          min={1}
          max={100}
          value={maxVideos}
          onChange={(e) => setMaxVideos(parseInt(e.target.value, 10) || 10)}
          disabled={loading}
        />

        {error && <p className="youtube-error">{error}</p>}

        <button
          type="button"
          className="youtube-btn"
          onClick={handleDownload}
          disabled={loading}
        >
          {loading ? 'Downloading…' : 'Download Channel Data'}
        </button>

        {loading && (
          <div className="youtube-progress-wrap">
            <div className="youtube-progress-bar">
              <div className="youtube-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="youtube-progress-text">
              {progress.current} / {progress.total} — {progress.message}
            </p>
          </div>
        )}

        {!loading && resultData && (
          <div className="youtube-result">
            <p className="youtube-result-summary">
              Downloaded {resultData.length} video{resultData.length !== 1 ? 's' : ''}.
            </p>
            <button type="button" className="youtube-btn youtube-btn-download" onClick={handleDownloadJson}>
              Download JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
