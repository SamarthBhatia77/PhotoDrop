import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { PhotoItem, CompressionPreset, ConnectionState } from '../types';
import { compressImage, formatBytes, calculateSavings } from '../lib/compression';
import { PhotoTransferProtocol } from '../lib/transfer';

interface IPhoneSenderViewProps {
  roomId: string;
  shortCode: string;
  connectionState: ConnectionState;
  transferProtocol: PhotoTransferProtocol | null;
  onRetryConnection: () => void;
}

export const IPhoneSenderView: React.FC<IPhoneSenderViewProps> = ({
  roomId,
  shortCode,
  connectionState,
  transferProtocol,
  onRetryConnection,
}) => {
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [showSettings, setShowSettings] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [queue, setQueue] = useState<PhotoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState<number>(0);
  const [overallProgress, setOverallProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file picker selection
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    // Reset file input so same photos can be selected again if needed
    e.target.value = '';

    const newItems: PhotoItem[] = fileList.map((file, idx) => ({
      id: `p_${Date.now()}_${idx}`,
      name: file.name,
      originalSize: file.size,
      compressedSize: 0,
      mimeType: file.type || 'image/jpeg',
      progress: 0,
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Begin compression and transfer
    processAndSendPhotos(fileList, newItems);
  };

  const processAndSendPhotos = async (files: File[], items: PhotoItem[]) => {
    if (!transferProtocol) return;
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const item = items[i];

      // Update status to compressing
      setQueue((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: 'compressing' } : p))
      );

      try {
        // Compress locally on iPhone
        const comp = await compressImage(file, preset);
        const objectUrl = URL.createObjectURL(comp.blob);

        const updatedItem: PhotoItem = {
          ...item,
          name: comp.name,
          blob: comp.blob,
          compressedSize: comp.compressedSize,
          width: comp.width,
          height: comp.height,
          objectUrl,
          status: 'pending',
        };

        setQueue((prev) =>
          prev.map((p) => (p.id === item.id ? updatedItem : p))
        );

        // If autoSend is enabled and connected, send immediately
        if (autoSend && connectionState === 'connected') {
          await sendSinglePhoto(updatedItem, i + 1, files.length);
        }
      } catch (err: any) {
        console.error('Compression or send error:', err);
        setQueue((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: 'failed', error: err.message || 'Failed' } : p
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const sendSinglePhoto = async (photo: PhotoItem, currentIdx: number, totalCount: number) => {
    if (!transferProtocol) return;

    setActivePhotoId(photo.id);
    setActiveProgress(0);

    setQueue((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, status: 'transferring' } : p))
    );

    try {
      await transferProtocol.sendPhoto(photo, (progress) => {
        setActiveProgress(progress);
        const overall = Math.round(((currentIdx - 1 + progress / 100) / totalCount) * 100);
        setOverallProgress(overall);
      });

      setQueue((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, status: 'completed', progress: 100 } : p))
      );

      // Trigger celebratory confetti on last photo
      if (currentIdx === totalCount) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      }
    } catch (err: any) {
      console.error('Failed to send photo:', err);
      setQueue((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, status: 'failed', error: err.message || 'Transfer failed' } : p
        )
      );
    } finally {
      setActivePhotoId(null);
    }
  };

  const handleManualSendPending = async () => {
    if (!transferProtocol || connectionState !== 'connected') return;

    const pending = queue.filter((p) => p.status === 'pending' || p.status === 'failed');
    if (pending.length === 0) return;

    setIsProcessing(true);
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.blob) {
        await sendSinglePhoto(p, i + 1, pending.length);
      }
    }
    setIsProcessing(false);
  };

  // Count stats
  const completedCount = queue.filter((p) => p.status === 'completed').length;
  const pendingCount = queue.filter((p) => p.status === 'pending' || p.status === 'failed').length;

  return (
    <div className="flex-1 flex flex-col w-full" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Hidden file input supporting camera & library */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      {/* Connection State Card */}
      <div
        className="glass-panel flex items-center justify-between"
        style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: connectionState === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: connectionState === 'connected' ? '#34d399' : '#fbbf24',
            }}
          >
            <Zap size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: '#f8fafc' }}>
                {connectionState === 'connected' ? 'Connected to Windows Laptop' : 'Connecting to Laptop...'}
              </span>
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              Room: <span className="font-mono font-bold" style={{ color: '#f8fafc' }}>{shortCode}</span>
            </p>
          </div>
        </div>

        <div>
          {connectionState === 'connected' ? (
            <div className="status-badge connected">
              <span className="pulse-dot emerald"></span>
              <span>Ready</span>
            </div>
          ) : (
            <button
              onClick={onRetryConnection}
              className="btn btn-secondary text-xs"
              style={{ padding: '0.35rem 0.75rem' }}
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Big Touch-Friendly Action Button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={connectionState !== 'connected' && connectionState !== 'connecting'}
          className="btn btn-primary w-full"
          style={{
            padding: '1.25rem 1.5rem',
            fontSize: '1.15rem',
            borderRadius: '1.25rem',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.45)',
          }}
        >
          <Camera size={26} />
          <span>Select Photos from iPhone</span>
        </button>
        <p className="text-xs text-center" style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
          Select 1, 10, or 20+ photos at once. Compresses automatically before sending.
        </p>
      </div>

      {/* Compression & Preset Bar */}
      <div
        className="glass-panel-subtle flex items-center justify-between"
        style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', borderRadius: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <Sliders size={16} style={{ color: '#818cf8' }} />
          <span className="text-xs" style={{ color: '#cbd5e1' }}>
            Quality: <strong>{preset === 'balanced' ? 'Balanced (2400px)' : preset === 'fast' ? 'Fast (1600px)' : 'Original (Raw)'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1">
          {(['balanced', 'fast', 'original'] as CompressionPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '0.4rem',
                border: 'none',
                cursor: 'pointer',
                background: preset === p ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                color: preset === p ? '#ffffff' : '#94a3b8',
                fontWeight: preset === p ? 700 : 400,
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer Progress Header if transferring */}
      {isProcessing && (
        <div
          className="glass-panel"
          style={{ padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}
        >
          <div className="flex items-center justify-between text-xs" style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Streaming to Laptop...</span>
            <span style={{ color: '#818cf8', fontWeight: 700 }}>{activeProgress}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${activeProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
                borderRadius: '9999px',
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Selected Photos Queue */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
            <span className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
              Photo Queue ({completedCount}/{queue.length} Sent)
            </span>

            {pendingCount > 0 && !isProcessing && (
              <button
                onClick={handleManualSendPending}
                className="btn btn-secondary text-xs"
                style={{ padding: '0.35rem 0.75rem' }}
              >
                <Send size={12} />
                <span>Send Remaining ({pendingCount})</span>
              </button>
            )}
          </div>

          {queue.map((item) => {
            const savings = calculateSavings(item.originalSize, item.compressedSize);
            return (
              <div
                key={item.id}
                className="glass-panel flex items-center justify-between"
                style={{
                  padding: '0.75rem 1rem',
                  border: item.id === activePhotoId ? '1px solid rgba(99, 102, 241, 0.4)' : undefined,
                }}
              >
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  {item.objectUrl ? (
                    <img
                      src={item.objectUrl}
                      alt=""
                      style={{
                        width: '42px',
                        height: '42px',
                        objectFit: 'cover',
                        borderRadius: '0.5rem',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                      }}
                    >
                      <ImageIcon size={20} />
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '180px',
                      }}
                    >
                      {item.name}
                    </div>
                    <div className="text-xs" style={{ color: '#94a3b8' }}>
                      {item.compressedSize ? (
                        <>
                          {formatBytes(item.compressedSize)}
                          {savings > 0 && <span style={{ color: '#34d399', marginLeft: '4px' }}>(-{savings}%)</span>}
                        </>
                      ) : (
                        formatBytes(item.originalSize)
                      )}
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div>
                  {item.status === 'completed' && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#34d399', fontWeight: 600 }}>
                      <CheckCircle2 size={16} />
                      <span>Sent</span>
                    </div>
                  )}

                  {item.status === 'transferring' && (
                    <span className="font-mono text-xs font-bold" style={{ color: '#818cf8' }}>
                      {activeProgress}%
                    </span>
                  )}

                  {item.status === 'compressing' && (
                    <span className="text-xs" style={{ color: '#fbbf24' }}>
                      Optimizing...
                    </span>
                  )}

                  {item.status === 'pending' && (
                    <span className="text-xs" style={{ color: '#64748b' }}>
                      Queued
                    </span>
                  )}

                  {item.status === 'failed' && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#fb7185' }}>
                      <AlertCircle size={14} />
                      <span>Failed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
