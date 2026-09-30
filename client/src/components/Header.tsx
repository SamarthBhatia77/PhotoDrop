import React from 'react';
import { Smartphone, Laptop, Zap, Sparkles } from 'lucide-react';
import type { ConnectionState } from '../types';
import { PrivacyBadge } from './PrivacyBadge';

interface HeaderProps {
  currentRole: 'receiver' | 'sender';
  connectionState: ConnectionState;
  onSwitchRole: (newRole: 'receiver' | 'sender') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  connectionState,
  onSwitchRole,
}) => {
  return (
    <header
      className="glass-panel flex items-center justify-between flex-wrap gap-4"
      style={{
        padding: '0.85rem 1.5rem',
        marginBottom: '1.5rem',
        borderRadius: '1rem',
      }}
    >
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            color: '#ffffff',
          }}
        >
          <Zap size={22} />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title" style={{ fontSize: '1.35rem' }}>
              PhotoDrop
            </h1>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontWeight: 700,
              }}
            >
              P2P AirBridge
            </span>
          </div>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            Direct iPhone to Windows Photo Transfer
          </p>
        </div>
      </div>

      {/* Role Switcher & Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Device switcher */}
        <div
          className="glass-panel-subtle flex items-center"
          style={{ padding: '0.25rem', borderRadius: '0.6rem' }}
        >
          <button
            onClick={() => onSwitchRole('receiver')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: currentRole === 'receiver' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
              color: currentRole === 'receiver' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            <Laptop size={14} />
            <span>Laptop (Receive)</span>
          </button>

          <button
            onClick={() => onSwitchRole('sender')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: currentRole === 'sender' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
              color: currentRole === 'sender' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} />
            <span>iPhone (Send)</span>
          </button>
        </div>

        {/* Connection state pill */}
        <div>
          {connectionState === 'connected' && (
            <div className="status-badge connected">
              <span className="pulse-dot emerald"></span>
              <span>Connected</span>
            </div>
          )}
          {connectionState === 'waiting' && (
            <div className="status-badge waiting">
              <span className="pulse-dot amber"></span>
              <span>Waiting for iPhone</span>
            </div>
          )}
          {connectionState === 'connecting' && (
            <div className="status-badge connecting">
              <span className="pulse-dot indigo"></span>
              <span>Connecting...</span>
            </div>
          )}
          {connectionState === 'disconnected' && (
            <div className="status-badge disconnected">
              <span className="pulse-dot rose"></span>
              <span>Disconnected</span>
            </div>
          )}
        </div>

        <PrivacyBadge />
      </div>
    </header>
  );
};
