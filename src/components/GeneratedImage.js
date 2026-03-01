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
        <img
          src={dataUrl}
          alt="Generated"
          className="generated-image-thumb"
          onClick={() => setLightboxOpen(true)}
        />
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
