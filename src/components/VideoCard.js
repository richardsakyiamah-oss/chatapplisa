import './VideoCard.css';

export default function VideoCard({ video }) {
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Extract video ID from URL for thumbnail
  const getVideoId = (url) => {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(video.videoUrl);
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;

  return (
    <a
      href={video.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="video-card"
    >
      {thumbnailUrl && (
        <div className="video-card-thumbnail">
          <img src={thumbnailUrl} alt={video.title} />
          <div className="video-card-play-icon">▶</div>
        </div>
      )}
      <div className="video-card-content">
        <h4 className="video-card-title">{video.title}</h4>
        <div className="video-card-stats">
          <span className="video-card-stat">
            👁 {formatNumber(video.viewCount)} views
          </span>
          <span className="video-card-stat">
            👍 {formatNumber(video.likeCount)} likes
          </span>
          <span className="video-card-stat">
            💬 {formatNumber(video.commentCount)} comments
          </span>
        </div>
        <div className="video-card-date">{formatDate(video.releaseDate)}</div>
      </div>
    </a>
  );
}
