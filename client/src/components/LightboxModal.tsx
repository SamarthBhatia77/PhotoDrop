import React, { useEffect } from 'react';
import { X, Download, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PhotoItem } from '../types';
import { formatBytes } from '../lib/compression';

interface LightboxModalProps {
  photo: PhotoItem | null;
  photos: PhotoItem[];
  onClose: () => void;
  onDownload: (photo: PhotoItem) => void;
  onSelectPhoto: (photo: PhotoItem) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  photo,
  photos,
  onClose,
  onDownload,
  onSelectPhoto,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!photo) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        const idx = photos.findIndex((p) => p.id === photo.id);
        if (idx !== -1 && idx < photos.length - 1) {
          onSelectPhoto(photos[idx + 1]);
        }
      }
      if (e.key === 'ArrowLeft') {
        const idx = photos.findIndex((p) => p.id === photo.id);
        if (idx > 0) {
          onSelectPhoto(photos[idx - 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, photos, onClose, onSelectPhoto]);

  if (!photo) return null;

  const currentIndex = photos.findIndex((p) => p.id === photo.id);

  const handleCopy = async () => {
    if (!photo.blob) return;
    try {
      let clipboardBlob = photo.blob;
      if (photo.blob.type !== 'image/png') {
        const bmp = await createImageBitmap(photo.blob);
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          clipboardBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b || photo.blob!), 'image/png');
          });
        }
        bmp.close();
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': clipboardBlob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      onDownload(photo);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(5, 7, 12, 0.94)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>{photo.name}</h3>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            {formatBytes(photo.compressedSize)}
            {photo.width && photo.height ? ` • ${photo.width} × ${photo.height} px` : ''}
            {photos.length > 1 ? ` • ${currentIndex + 1} of ${photos.length}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="btn btn-secondary text-sm"
            style={{ padding: '0.45rem 0.85rem' }}
          >
            {copied ? (
              <>
                <Check size={16} style={{ color: '#34d399' }} />
                <span style={{ color: '#34d399' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Image</span>
              </>
            )}
          </button>

          <button
            onClick={() => onDownload(photo)}
            className="btn btn-primary text-sm"
            style={{ padding: '0.45rem 0.85rem' }}
          >
            <Download size={16} />
            <span>Download</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: '0.5rem',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image View */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          position: 'relative',
        }}
      >
        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectPhoto(photos[currentIndex - 1]);
            }}
            style={{
              position: 'absolute',
              left: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Real <img> element supporting Right-Click */}
        <img
          src={photo.objectUrl}
          alt={photo.name}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          }}
        />

        {/* Next Button */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectPhoto(photos[currentIndex + 1]);
            }}
            style={{
              position: 'absolute',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
};
