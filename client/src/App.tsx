import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { LaptopReceiverView } from './components/LaptopReceiverView';
import { IPhoneSenderView } from './components/IPhoneSenderView';
import { LightboxModal } from './components/LightboxModal';
import { SignalingClient, SignalingMessage } from './lib/signaling';
import { WebRTCManager, WebRTCConnectionState } from './lib/webrtc';
import { PhotoTransferProtocol } from './lib/transfer';
import type { PhotoItem, ConnectionState } from './types';
import { Smartphone, Laptop, KeyRound, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  // Detect if mobile / iPhone
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Parse URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = urlParams.get('room') || '';
  const initialRole = urlParams.get('role') as 'receiver' | 'sender' | null;

  const [role, setRole] = useState<'receiver' | 'sender'>(() => {
    if (initialRole) return initialRole;
    if (initialRoom || isMobileDevice) return 'sender';
    return 'receiver';
  });

  const [roomId, setRoomId] = useState<string>(initialRoom);
  const [shortCode, setShortCode] = useState<string>('');
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [port, setPort] = useState<number>(3000);
  const [tunnelUrl, setTunnelUrl] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState<string>('');

  // Fetch network info on mount to obtain tunnelUrl as soon as ready
  useEffect(() => {
    let timer: any = null;
    let attempts = 0;
    const checkNetworkInfo = async () => {
      try {
        const res = await fetch('/api/network-info');
        const data = await res.json();
        if (data.localIps) setLocalIps(data.localIps);
        if (data.port) setPort(data.port);
        if (data.tunnelUrl) {
          setTunnelUrl(data.tunnelUrl);
        } else if (attempts < 10) {
          attempts++;
          timer = setTimeout(checkNetworkInfo, 2500);
        }
      } catch { }
    };
    checkNetworkInfo();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeReceiving, setActiveReceiving] = useState<{ name: string; progress: number; speed?: string } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const transferProtocolRef = useRef<PhotoTransferProtocol | null>(null);

  const roomIdRef = useRef<string>(initialRoom);

  // Keep roomIdRef in sync with roomId
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Initialize room & connection based on role (only runs once per role switch)
  useEffect(() => {
    let isMounted = true;

    async function setupConnection() {
      cleanupInstances();
      setConnectionState('connecting');

      const signaling = new SignalingClient();
      signalingRef.current = signaling;

      try {
        await signaling.connect();
      } catch (e) {
        console.error('Signaling connection error:', e);
        if (isMounted) setConnectionState('disconnected');
        return;
      }

      if (role === 'receiver') {
        // Laptop creates room
        signaling.send({ type: 'create_room' });

        signaling.on('room_created', (msg: SignalingMessage) => {
          if (!isMounted) return;
          const newRoomId = msg.roomId || '';
          roomIdRef.current = newRoomId;
          setRoomId(newRoomId);
          setShortCode(msg.shortCode || '');
          setConnectionState('waiting');
          if (msg.payload?.localIps) {
            setLocalIps(msg.payload.localIps);
          }
          if (msg.payload?.port) {
            setPort(msg.payload.port);
          }
          if (msg.payload?.tunnelUrl) {
            setTunnelUrl(msg.payload.tunnelUrl);
          }
        });

        signaling.on('peer_joined', async (msg: SignalingMessage) => {
          if (!isMounted) return;
          const activeRoom = msg.roomId || roomIdRef.current;
          setConnectionState('connecting');

          // Initialize WebRTC as initiator
          initWebRTC(signaling, activeRoom, true);
          await webrtcRef.current?.startNegotiation();
        });

        signaling.on('peer_left', () => {
          if (!isMounted) return;
          setConnectionState('waiting');
          if (webrtcRef.current) {
            webrtcRef.current.close();
            webrtcRef.current = null;
          }
        });
      } else {
        // iPhone sender joins room
        const targetRoom = roomIdRef.current || initialRoom;
        if (targetRoom) {
          signaling.send({ type: 'join_room', roomId: targetRoom });
        }

        signaling.on('room_joined', (msg: SignalingMessage) => {
          if (!isMounted) return;
          const joinedId = msg.roomId || targetRoom;
          roomIdRef.current = joinedId;
          setRoomId(joinedId);
          setShortCode(msg.shortCode || '');
          setConnectionState('connecting');

          // Initialize WebRTC as responder
          initWebRTC(signaling, joinedId, false);
        });

        signaling.on('peer_left', () => {
          if (!isMounted) return;
          setConnectionState('disconnected');
        });

        signaling.on('error', (msg: SignalingMessage) => {
          if (!isMounted) return;
          alert(msg.error || 'Could not join room');
          setConnectionState('error');
        });
      }
    }

    setupConnection();

    return () => {
      isMounted = false;
      cleanupInstances();
    };
  }, [role]);

  function cleanupInstances() {
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    if (signalingRef.current) {
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }
    transferProtocolRef.current = null;
  }

  function initWebRTC(signaling: SignalingClient, currentRoomId: string, isInitiator: boolean) {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }

    const webrtc = new WebRTCManager({
      signaling,
      roomId: currentRoomId,
      isInitiator,
      onStateChange: (state: WebRTCConnectionState) => {
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'connecting') {
          setConnectionState('connecting');
        } else if (state === 'failed' || state === 'closed') {
          // If relay fallback kicked in, webrtc marks connected
          if (!webrtc.isConnected()) {
            setConnectionState('disconnected');
          }
        }
      },
      onDataMessage: (data) => {
        transferProtocolRef.current?.handleIncomingMessage(data);
      },
    });

    webrtcRef.current = webrtc;

    // Initialize transfer protocol
    const protocol = new PhotoTransferProtocol(webrtc, {
      onPhotoStart: (meta) => {
        setActiveReceiving({
          name: meta.name,
          progress: 0,
        });
      },
      onProgress: (_id, progress, speed) => {
        setActiveReceiving((prev) => (prev ? { ...prev, progress, speed } : null));
      },
      onPhotoComplete: (photo) => {
        setPhotos((prev) => [photo, ...prev]);
        setActiveReceiving(null);

        // Small celebratory confetti on laptop
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.6 },
        });
      },
      onError: (photoId, error) => {
        console.error(`Transfer error for photo ${photoId}:`, error);
        setActiveReceiving(null);
      },
    });

    transferProtocolRef.current = protocol;
  }

  // Download a single photo
  const handleDownloadSingle = (photo: PhotoItem) => {
    if (!photo.objectUrl) return;
    const a = document.createElement('a');
    a.href = photo.objectUrl;
    a.download = photo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Delete a single photo
  const handleDeleteSingle = (photoId: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
      }
      return prev.filter((p) => p.id !== photoId);
    });
  };

  // Clear all photos
  const handleClearAll = () => {
    photos.forEach((p) => {
      if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
    });
    setPhotos([]);
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCodeInput.trim().toUpperCase();
    if (!code) return;
    setRoomId(code);
    roomIdRef.current = code;
    setConnectionState('connecting');

    if (signalingRef.current && signalingRef.current.isConnected()) {
      signalingRef.current.send({ type: 'join_room', shortCode: code });
    }
  };

  const handleSwitchRole = (newRole: 'receiver' | 'sender') => {
    if (newRole === role) return;
    if (newRole === 'receiver') {
      setRoomId('');
      setShortCode('');
    }
    setRole(newRole);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        currentRole={role}
        connectionState={connectionState}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main View based on Role */}
      {role === 'receiver' ? (
        <LaptopReceiverView
          roomId={roomId}
          shortCode={shortCode}
          localIps={localIps}
          port={port}
          tunnelUrl={tunnelUrl}
          connectionState={connectionState}
          photos={photos}
          activeReceivingPhoto={activeReceiving}
          onDownloadSingle={handleDownloadSingle}
          onDeleteSingle={handleDeleteSingle}
          onClearAll={handleClearAll}
          onOpenLightbox={(photo) => setLightboxPhoto(photo)}
        />
      ) : (
        <>
          {/* If no roomId is set yet on sender, prompt for code */}
          {!roomId ? (
            <div className="glass-panel flex flex-col items-center justify-center text-center" style={{ padding: '2.5rem 1.5rem', maxWidth: '440px', margin: '2rem auto' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  marginBottom: '1rem',
                }}
              >
                <KeyRound size={28} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
                Enter Pairing Code
              </h2>
              <p className="text-xs" style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Look at the PhotoDrop screen on your laptop and enter the 4-character pairing code:
              </p>

              <form onSubmit={handleManualJoin} className="w-full flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="e.g. 4B7K"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="font-mono text-center font-bold"
                  style={{
                    padding: '0.85rem',
                    fontSize: '1.4rem',
                    letterSpacing: '0.2em',
                    background: '#0d121f',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.75rem',
                  }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary w-full" style={{ padding: '0.85rem' }}>
                  <span>Connect to Laptop</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
          ) : (
            <IPhoneSenderView
              roomId={roomId}
              shortCode={shortCode}
              connectionState={connectionState}
              transferProtocol={transferProtocolRef.current}
              onRetryConnection={() => {
                setConnectionState('connecting');
                signalingRef.current?.send({ type: 'join_room', roomId });
              }}
            />
          )}
        </>
      )}

      {/* Lightbox Modal */}
      <LightboxModal
        photo={lightboxPhoto}
        photos={photos}
        onClose={() => setLightboxPhoto(null)}
        onDownload={handleDownloadSingle}
        onSelectPhoto={(photo) => setLightboxPhoto(photo)}
      />
    </div>
  );
};
