import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Smartphone, Wifi, Globe, ChevronDown, Zap, ShieldCheck } from 'lucide-react';

interface QRCodeDisplayProps {
  roomId: string;
  shortCode: string;
  localIps: string[];
  port: number;
  tunnelUrl?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  roomId,
  shortCode,
  localIps,
  port,
  tunnelUrl,
}) => {
  // Check if accessing via a public cloud host/domain (e.g. Render, Railway, Fly.io, custom domain)
  const isPublicHost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return (
      h !== 'localhost' &&
      h !== '127.0.0.1' &&
      !h.startsWith('192.168.') &&
      !h.startsWith('10.') &&
      !h.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    );
  }, []);

  // Check if current network looks like an iPhone Hotspot (172.20.10.x)
  const isHotspotSubnet = localIps.some((ip) => ip.startsWith('172.20.10.'));

  // Default to public web mode if hosted on a public domain, else hotspot tunnel or local LAN
  const [networkMode, setNetworkMode] = useState<'public' | 'tunnel' | 'lan'>(() => {
    if (isPublicHost) return 'public';
    if (tunnelUrl || isHotspotSubnet) return 'tunnel';
    return 'lan';
  });

  const [selectedIp, setSelectedIp] = useState<string>(() => {
    return localIps[0] || window.location.hostname;
  });
  const [customHost, setCustomHost] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compute the URL that the iPhone will open
  const joinUrl = useMemo(() => {
    if (customHost.trim()) {
      const h = customHost.trim();
      const prefix = h.startsWith('http://') || h.startsWith('https://') ? '' : 'https://';
      return `${prefix}${h}/?room=${roomId}&role=sender`;
    }

    if (networkMode === 'public') {
      return `${window.location.origin}/?room=${roomId}&role=sender`;
    }

    if (networkMode === 'tunnel' && tunnelUrl) {
      return `${tunnelUrl}/?room=${roomId}&role=sender`;
    }

    const host = `${selectedIp}:${port}`;
    const protocol = window.location.protocol;
    return `${protocol}//${host}/?room=${roomId}&role=sender`;
  }, [networkMode, tunnelUrl, customHost, selectedIp, port, roomId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', width: '100%', maxWidth: '420px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
        <div className="flex items-center gap-2">
          <div
            style={{
              padding: '0.4rem',
              background: 'rgba(99, 102, 241, 0.15)',
              borderRadius: '0.5rem',
              color: '#818cf8',
            }}
          >
            <QrCode size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>Scan with iPhone</h3>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Point iPhone Camera to connect</p>
          </div>
        </div>

        <div className="status-badge waiting">
          <span className="pulse-dot amber"></span>
          <span>Ready to pair</span>
        </div>
      </div>

      {/* Network Mode Switcher */}
      <div
        className="glass-panel-subtle flex items-center"
        style={{ padding: '0.25rem', borderRadius: '0.65rem', marginBottom: '1.25rem' }}
      >
        {isPublicHost ? (
          <button
            onClick={() => setNetworkMode('public')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.45rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: networkMode === 'public' ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
              color: networkMode === 'public' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            <Globe size={14} style={{ color: '#818cf8' }} />
            <span>Public Web</span>
          </button>
        ) : (
          <button
            onClick={() => setNetworkMode('tunnel')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.45rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: networkMode === 'tunnel' ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
              color: networkMode === 'tunnel' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={14} style={{ color: '#818cf8' }} />
            <span>Hotspot / Remote</span>
          </button>
        )}

        <button
          onClick={() => setNetworkMode('lan')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            padding: '0.45rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: networkMode === 'lan' ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
            color: networkMode === 'lan' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          <Wifi size={14} style={{ color: '#34d399' }} />
          <span>Home Wi-Fi</span>
        </button>
      </div>

      {/* QR Code container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          background: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
          margin: '0 auto 1.25rem',
          width: 'fit-content',
        }}
      >
        <QRCodeSVG
          value={joinUrl}
          size={210}
          level="M"
          includeMargin={false}
        />
      </div>

      {/* Pairing code & Copy link */}
      <div
        className="glass-panel-subtle flex items-center justify-between"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div>
          <span className="text-xs" style={{ color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pairing Code
          </span>
          <span className="font-mono font-bold" style={{ fontSize: '1.3rem', color: '#f8fafc', letterSpacing: '0.15em' }}>
            {shortCode}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="btn btn-secondary text-sm"
          style={{ padding: '0.45rem 0.85rem' }}
          title="Copy direct join link"
        >
          {copied ? (
            <>
              <Check size={15} style={{ color: '#34d399' }} />
              <span style={{ color: '#34d399' }}>Copied</span>
            </>
          ) : (
            <>
              <Copy size={15} />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>

      {/* Mode explanation banner */}
      <div
        style={{
          padding: '0.75rem',
          background:
            networkMode === 'public' || networkMode === 'tunnel'
              ? 'rgba(99, 102, 241, 0.08)'
              : 'rgba(16, 185, 129, 0.08)',
          borderRadius: '0.75rem',
          border: `1px solid ${
            networkMode === 'public' || networkMode === 'tunnel'
              ? 'rgba(99, 102, 241, 0.25)'
              : 'rgba(16, 185, 129, 0.25)'
          }`,
          fontSize: '0.8rem',
          color: '#cbd5e1',
          marginBottom: '0.75rem',
          lineHeight: 1.45,
        }}
      >
        {networkMode === 'public' ? (
          <div>
            <strong>🌐 Public Web Mode:</strong> Connected via <code>{typeof window !== 'undefined' ? window.location.host : ''}</code>. Anyone scanning this QR code from any Wi-Fi or cellular network worldwide will pair instantly.
          </div>
        ) : networkMode === 'tunnel' ? (
          <div>
            <strong>📱 Hotspot / Anywhere Mode:</strong> Uses a direct secure HTTPS tunnel. This fixes the Apple iOS restriction that blocks Safari from accessing laptop local IPs on personal hotspots.
          </div>
        ) : (
          <div>
            <strong>🏠 Home Wi-Fi Mode:</strong> Directly reaches your laptop over your local home router ({selectedIp}).
          </div>
        )}
      </div>

      {/* Advanced Network settings */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
            padding: '0.25rem 0',
          }}
        >
          <Wifi size={13} />
          <span>Manual IP / Tunnel URL</span>
          <ChevronDown size={13} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showAdvanced && (
          <div
            className="glass-panel-subtle"
            style={{
              padding: '0.75rem',
              marginTop: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Custom Tunnel URL or Hostname:
            </label>
            <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
              <Globe size={14} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={tunnelUrl || 'e.g. xyz.trycloudflare.com'}
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  background: '#0d121f',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.4rem',
                  fontSize: '0.8rem',
                }}
              />
            </div>

            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Select Wi-Fi Adapter IP:
            </label>
            <select
              value={selectedIp}
              onChange={(e) => setSelectedIp(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                background: '#0d121f',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0.4rem',
                fontSize: '0.8rem',
              }}
            >
              {localIps.map((ip) => (
                <option key={ip} value={ip}>
                  {ip}
                </option>
              ))}
              <option value="localhost">localhost</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
