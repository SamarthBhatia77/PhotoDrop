import React, { useState } from 'react';
import { Download, Copy, Check, Maximize2, Trash2, Zap } from 'lucide-react';
import type { PhotoItem } from '../types';
import { formatBytes, calculateSavings } from '../lib/compression';

interface PhotoCardProps {
  photo: PhotoItem;
  onDownload: (photo: PhotoItem) => void;
  onDelete: (photoId: string) => void;
  onOpenLightbox: (photo: PhotoItem) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onDownload,
  onDelete,
  onOpenLightbox,
}) => {
  const [copied, setCopied] = useState(false);
  const savings = calculateSavings(photo.originalSize, photo.compressedSize);

  const handleCopyClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!photo.blob) return;

    try {
      // Modern browsers support writing PNG to clipboard
      // If jpeg, convert to PNG blob for clipboard compatibility
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
        new ClipboardItem({
          'image/png': clipboardBlob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      // Fallback: download
      onDownload(photo);
    }
  };

  return (
    <div className="photo-card flex flex-col">
      {/* Real HTML <img> for Windows Right-Click -> Save image as... or Copy image */}
      <div
        className="photo-card-img-wrapper"
        onClick={() => onOpenLightbox(photo)}
        title="Click to view full size, or Right-Click to Save/Copy"
      >
        <img
          src={photo.objectUrl}
          alt={photo.name}
          loading="lazy"
          // Keep normal context menu enabled for right-click Save image as...
          onContextMenu={(e) => {
            // Do not prevent default! Allow browser's native right-click menu!
            e.stopPropagation();
          }}
        />

        {/* Hover overlay icons */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '6px',
            zIndex: 10,
          }}
        >
          {savings > 0 && (
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.9)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Zap size={11} />
              -{savings}%
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLightbox(photo);
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
            title="Inspect Full Size"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Card Info & Actions */}
      <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#f8fafc',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '0.35rem',
            }}
            title={photo.name}
          >
            {photo.name}
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
            <span>{formatBytes(photo.compressedSize)}</span>
            {photo.speed && <span style={{ color: '#818cf8' }}>{photo.speed}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Download button */}
          <button
            onClick={() => onDownload(photo)}
            className="btn btn-secondary flex-1 text-xs"
            style={{ padding: '0.45rem 0.6rem' }}
            title="Download to PC"
          >
            <Download size={14} />
            <span>Save</span>
          </button>

          {/* Copy to Clipboard button */}
          <button
            onClick={handleCopyClipboard}
            className="btn btn-secondary text-xs"
            style={{ padding: '0.45rem 0.6rem' }}
            title="Copy image to Windows clipboard"
          >
            {copied ? (
              <Check size={14} style={{ color: '#34d399' }} />
            ) : (
              <Copy size={14} />
            )}
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(photo.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              padding: '0.4rem',
              cursor: 'pointer',
              borderRadius: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Remove from session"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fb7185')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
