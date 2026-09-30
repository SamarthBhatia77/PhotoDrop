import React from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { PhotoGallery } from './PhotoGallery';
import type { PhotoItem, ConnectionState } from '../types';
import { Smartphone, Zap, ArrowDownCircle, CheckCircle2 } from 'lucide-react';

interface LaptopReceiverViewProps {
  roomId: string;
  shortCode: string;
  localIps: string[];
  port: number;
  tunnelUrl?: string;
  connectionState: ConnectionState;
  photos: PhotoItem[];
  activeReceivingPhoto: { name: string; progress: number; speed?: string } | null;
  onDownloadSingle: (photo: PhotoItem) => void;
  onDeleteSingle: (photoId: string) => void;
  onClearAll: () => void;
  onOpenLightbox: (photo: PhotoItem) => void;
}

export const LaptopReceiverView: React.FC<LaptopReceiverViewProps> = ({
  roomId,
  shortCode,
  localIps,
  port,
  tunnelUrl,
  connectionState,
  photos,
  activeReceivingPhoto,
  onDownloadSingle,
  onDeleteSingle,
  onClearAll,
  onOpenLightbox,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 380px) 1fr',
        gap: '1.5rem',
        alignItems: 'start',
      }}
      className="laptop-view-grid"
    >
      {/* Left Column: QR Code & Pairing */}
      <div className="flex flex-col gap-4">
        <QRCodeDisplay
          roomId={roomId}
          shortCode={shortCode}
          localIps={localIps}
          port={port}
          tunnelUrl={tunnelUrl}
        />

        {/* Live Incoming Transfer Activity Indicator */}
        {activeReceivingPhoto && (
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.05)',
            }}
          >
            <div className="flex items-center justify-between text-xs" style={{ marginBottom: '0.5rem' }}>
              <div className="flex items-center gap-2">
                <ArrowDownCircle size={16} style={{ color: '#34d399' }} />
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                  Receiving: {activeReceivingPhoto.name}
                </span>
              </div>
              <span className="font-mono font-bold" style={{ color: '#34d399' }}>
                {activeReceivingPhoto.progress}%
              </span>
            </div>

            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '9999px',
                overflow: 'hidden',
                marginBottom: '0.4rem',
              }}
            >
              <div
                style={{
                  width: `${activeReceivingPhoto.progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
                  borderRadius: '9999px',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>

            {activeReceivingPhoto.speed && (
              <div className="text-xs" style={{ color: '#94a3b8', textAlign: 'right' }}>
                Speed: <span style={{ color: '#818cf8', fontWeight: 600 }}>{activeReceivingPhoto.speed}</span>
              </div>
            )}
          </div>
        )}

        {/* Pairing Status Card */}
        <div className="glass-panel-subtle" style={{ padding: '1rem 1.25rem' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: connectionState === 'connected' ? '#34d399' : '#fbbf24',
              }}
            >
              {connectionState === 'connected' ? <CheckCircle2 size={18} /> : <Smartphone size={18} />}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                {connectionState === 'connected' ? 'iPhone Paired & Active' : 'Waiting for iPhone to join'}
              </div>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                {connectionState === 'connected'
                  ? 'Ready to receive compressed photos'
                  : 'Open camera app on iPhone and point at QR code'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Received Photos Gallery */}
      <PhotoGallery
        photos={photos}
        onDownloadSingle={onDownloadSingle}
        onDeleteSingle={onDeleteSingle}
        onClearAll={onClearAll}
        onOpenLightbox={onOpenLightbox}
      />
    </div>
  );
};
