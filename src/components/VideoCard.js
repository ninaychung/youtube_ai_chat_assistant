import React from 'react';
import './VideoCard.css';

export default function VideoCard({ videoUrl, title, thumbnailUrl }) {
  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="video-card"
    >
      <div className="video-card-thumb">
        <img src={thumbnailUrl} alt="" />
      </div>
      <div className="video-card-title">{title}</div>
      <span className="video-card-hint">Opens in new tab →</span>
    </a>
  );
}
