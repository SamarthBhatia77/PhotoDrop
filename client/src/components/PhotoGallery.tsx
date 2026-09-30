import React, { useState } from 'react';
import JSZip from 'jszip';
import { DownloadCloud, Trash2, Images, Sparkles, Zap, MousePointer } from 'lucide-react';
import type { PhotoItem } from '../types';
import { PhotoCard } from './PhotoCard';
import { formatBytes, calculateSavings } from '../lib/compression';

interface PhotoGalleryProps {
  photos: PhotoItem[];
  onDownloadSingle: (photo: PhotoItem) => void;
  onDeleteSingle: (photoId: string) => void;
  onClearAll: () => void;
  onOpenLightbox: (photo: PhotoItem) => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onDownloadSingle,
  onDeleteSingle,
  onClearAll,
  onOpenLightbox,
}) => {
  const [isZipping, setIsZipping] = useState(false);

  // Compute totals
  const totalOriginal = photos.reduce((sum, p) => sum + (p.originalSize || 0), 0);
  const totalCompressed = photos.reduce((sum, p) => sum + (p.compressedSize || 0), 0);
  const totalSavedPercent = calculateSavings(totalOriginal, totalCompressed);

  const handleDownloadAllZip = async () => {
    if (photos.length === 0 || isZipping) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      for (const p of photos) {
        if (p.blob) {
          zip.file(p.name, p.blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photodrop_${photos.length}_photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col" style={{ width: '100%' }}>
      {/* Gallery Header */}
      <div
        className="glass-panel flex items-center justify-between flex-wrap gap-4"
        style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem' }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              padding: '0.45rem',
              background: 'rgba(99, 102, 241, 0.15)',
              borderRadius: '0.5rem',
              color: '#818cf8',
            }}
          >
            <Images size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>Received Photos</h2>
              <span
                style={{
                  background: 'rgba(99, 102, 241, 0.25)',
                  color: '#818cf8',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                {photos.length}
              </span>
            </div>
            {photos.length > 0 && (
              <p className="text-xs" style={{ color: '#94a3b8', marginTop: '2px' }}>
                Total: {formatBytes(totalCompressed)}{' '}
                {totalSavedPercent > 0 && (
                  <span style={{ color: '#34d399', marginLeft: '6px' }}>
                    (Saved ~{totalSavedPercent}% bandwidth)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Gallery Action Buttons */}
        {photos.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping}
              className="btn btn-primary text-sm"
              style={{ padding: '0.5rem 1rem' }}
            >
              <DownloadCloud size={16} />
              <span>{isZipping ? 'Zipping...' : `Download All (${photos.length})`}</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Clear all received photos from this session?')) {
                  onClearAll();
                }
              }}
              className="btn btn-secondary text-sm"
              style={{ padding: '0.5rem 0.85rem', color: '#94a3b8' }}
              title="Clear gallery"
            >
              <Trash2 size={16} />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Helpful Right-Click Tip Banner */}
      {photos.length > 0 && (
        <div
          className="flex items-center gap-2 text-xs"
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          <MousePointer size={14} style={{ color: '#818cf8' }} />
          <span>
            <strong>Windows Pro Tip:</strong> Right-click on any photo to use native Windows <em>"Save image as..."</em> or <em>"Copy image"</em> directly into Photoshop/Discord/Word!
          </span>
        </div>
      )}

      {/* Photo Grid or Empty State */}
      {photos.length === 0 ? (
        <div
          className="glass-panel flex flex-col items-center justify-center text-center flex-1"
          style={{
            padding: '3.5rem 1.5rem',
            minHeight: '340px',
            borderStyle: 'dashed',
            borderColor: 'rgba(255, 255, 255, 0.12)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              marginBottom: '1rem',
            }}
          >
            <Images size={32} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
            Your received gallery is empty
          </h3>
          <p className="text-sm" style={{ color: '#94a3b8', maxWidth: '400px', lineHeight: 1.5 }}>
            Photos you pick and send on your iPhone will stream directly onto your laptop screen here in real time.
          </p>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onDownload={onDownloadSingle}
              onDelete={onDeleteSingle}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
};
