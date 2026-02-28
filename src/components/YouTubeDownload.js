import { useState } from 'react';
import { downloadChannelDataToJson } from '../services/youtubeDownload';
import './YouTubeDownload.css';

export default function YouTubeDownload({ onJsonLoaded }) {
  const [channelUrl, setChannelUrl] = useState('');
  const [maxVideos, setMaxVideos] = useState(10);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (!channelUrl.trim()) {
      setError('Please enter a YouTube channel URL');
      return;
    }

    if (maxVideos < 1 || maxVideos > 100) {
      setError('Max videos must be between 1 and 100');
      return;
    }

    setError('');
    setDownloading(true);
    setProgress(0);

    try {
      const data = await downloadChannelDataToJson(channelUrl, maxVideos, setProgress);
      // Auto-link the downloaded JSON into the chat session
      if (onJsonLoaded && data) {
        const filename = `${(data.channelId || 'channel').replace('@', '')}_${data.videoCount}_videos.json`;
        onJsonLoaded({ name: filename, data });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  return (
    <div className="youtube-download">
      <div className="youtube-download-card">
        <h2>YouTube Channel Data Download</h2>
        <p className="youtube-download-description">
          Download metadata for videos from a YouTube channel including title, description, 
          transcript, duration, release date, view count, like count, comment count, and video URL.
        </p>

        <div className="youtube-download-form">
          <div className="form-group">
            <label htmlFor="channelUrl">YouTube Channel URL</label>
            <input
              id="channelUrl"
              type="text"
              placeholder="https://www.youtube.com/@veritasium"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              disabled={downloading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxVideos">Max Videos (1-100)</label>
            <input
              id="maxVideos"
              type="number"
              min="1"
              max="100"
              value={maxVideos}
              onChange={(e) => setMaxVideos(parseInt(e.target.value) || 10)}
              disabled={downloading}
            />
          </div>

          {error && <div className="youtube-download-error">{error}</div>}

          {downloading && (
            <div className="youtube-download-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-text">{Math.round(progress)}%</div>
            </div>
          )}

          <button
            className="download-button"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download Channel Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
