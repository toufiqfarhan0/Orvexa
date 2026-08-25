import React, { useState, useEffect } from 'react';
import { ShieldCheck, TerminalWindow } from '@phosphor-icons/react';
import type { HealthCheckResponse } from '@orvexa/shared';

interface NavbarProps {
  onOpenConsole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenConsole }) => {
  const [backendHealth, setBackendHealth] = useState<'connected' | 'checking' | 'offline'>(
    'checking'
  );

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data: HealthCheckResponse = await res.json();
          if (data.status === 'ok') {
            setBackendHealth('connected');
            return;
          }
        }
        setBackendHealth('offline');
      } catch {
        setBackendHealth('offline');
      }
    };

    checkHealth();
  }, []);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 'var(--nav-height)',
        backgroundColor: 'rgba(8, 9, 13, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-dim)',
      }}
    >
      <div
        className="app-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
        }}
      >
        {/* Brand Logo */}
        <a
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <ShieldCheck size={20} weight="bold" />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '1.0625rem',
              letterSpacing: '-0.025em',
            }}
          >
            Orvexa
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
          }}
          className="desktop-nav"
        >
          <a href="#how-it-works" className="btn-ghost btn" style={{ padding: '0.4rem 0.6rem' }}>
            How It Works
          </a>
          <a
            href="#safety-architecture"
            className="btn-ghost btn"
            style={{ padding: '0.4rem 0.6rem' }}
          >
            Safety Guarantees
          </a>
          <a
            href="#trueforge-platform"
            className="btn-ghost btn"
            style={{ padding: '0.4rem 0.6rem' }}
          >
            TrueForge Platform
          </a>
          <a
            href="#interactive-proof"
            className="btn-ghost btn"
            style={{ padding: '0.4rem 0.6rem' }}
          >
            Live Verification
          </a>
        </div>

        {/* Right Action & Status Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Backend Status Chip */}
          <span
            className={`badge ${
              backendHealth === 'connected'
                ? 'badge-success'
                : backendHealth === 'checking'
                  ? 'badge-neutral'
                  : 'badge-warning'
            }`}
            title="Backend Server API Connectivity"
          >
            <span className="status-indicator" />
            <span style={{ textTransform: 'uppercase' }}>
              {backendHealth === 'connected'
                ? 'Engine Ready'
                : backendHealth === 'checking'
                  ? 'Connecting'
                  : 'Standby'}
            </span>
          </span>

          <button onClick={onOpenConsole} className="btn btn-primary" id="nav-cta-btn">
            <TerminalWindow size={16} weight="bold" />
            <span>Launch Console</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
