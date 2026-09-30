import React, { useState } from 'react';
import { ShieldCheck, Info, X } from 'lucide-react';

export const PrivacyBadge: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="glass-panel-subtle flex items-center gap-2"
        style={{
          padding: '0.4rem 0.8rem',
          cursor: 'pointer',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          background: 'rgba(16, 185, 129, 0.06)',
          borderRadius: '9999px',
          color: '#34d399',
          fontSize: '0.8rem',
          fontWeight: 500,
        }}
        title="Click to view privacy architecture"
      >
        <ShieldCheck size={16} />
        <span>100% Zero-Storage & P2P</span>
        <Info size={13} style={{ opacity: 0.7 }} />
      </button>

      {showDetails && (
        <div
          className="glass-panel-elevated"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            padding: '1.25rem',
            zIndex: 100,
            fontSize: '0.85rem',
            lineHeight: '1.4',
            color: '#cbd5e1',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
            <div className="flex items-center gap-2 font-semibold text-emerald" style={{ color: '#34d399' }}>
              <ShieldCheck size={18} />
              <span>Zero-Cloud Architecture</span>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>No Photos Saved:</strong> Photos are transferred directly from your iPhone to this laptop browser. They exist only in temporary browser memory.
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Local Compression:</strong> Photos are compressed on your iPhone before sending to save bandwidth and speed up transfer.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            When you close this browser tab, transfer state is immediately destroyed.
          </p>
        </div>
      )}
    </div>
  );
};
