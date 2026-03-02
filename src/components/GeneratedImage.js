import { useState } from 'react';
import './GeneratedImage.css';

export default function GeneratedImage({ dataUrl }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `generated-${Date.now()}.png`;
    a.click();
  };

  return (
    <>
      <div className="generated-image-wrap">
        <span className="generated-image-label">Generated image</span>
        <div
          className="generated-image-thumb-wrap"
          onClick={() => setLightboxOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
        >
          <img
            src={dataUrl}
            alt="Generated"
            className="generated-image-thumb"
          />
        </div>
        <div className="generated-image-actions">
          <button type="button" onClick={() => setLightboxOpen(true)}>
            Enlarge
          </button>
          <button type="button" onClick={handleDownload}>
            Download
          </button>
        </div>
      </div>
      {lightboxOpen && (
        <div className="generated-image-lightbox" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="generated-image-lightbox-close" onClick={() => setLightboxOpen(false)}>
            ×
          </button>
          <img src={dataUrl} alt="Generated (enlarged)" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="generated-image-lightbox-dl" onClick={handleDownload}>
            Download
          </button>
        </div>
      )}
    </>
  );
}
