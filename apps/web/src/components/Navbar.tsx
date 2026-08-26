import React, { useState, useEffect } from 'react';
import { ShieldCheck, TerminalWindow } from '@phosphor-icons/react';
import type { HealthCheckResponse } from '@orvexa/shared';
import {
  mapHealthStatus,
  getHealthDisplayConfig,
  type BackendHealthState,
} from '../utils/health.js';

interface NavbarProps {
  onOpenConsole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenConsole }) => {
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>('checking');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!isMounted) return;
        if (res.ok) {
          const data: HealthCheckResponse = await res.json();
          setBackendHealth(mapHealthStatus(data.status));
        } else {
          setBackendHealth('offline');
        }
      } catch {
        if (isMounted) {
          setBackendHealth('offline');
        }
      }
    };

    checkHealth();

    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMounted = false;
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const healthConfig = getHealthDisplayConfig(backendHealth);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0.75rem 1.5rem',
        transition: 'padding 200ms ease',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.82)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-btn)',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '0.5rem 0.75rem 0.5rem 1rem',
          transition: 'box-shadow 200ms ease, background 200ms ease',
        }}
      >
        {/* Brand Logo */}
        <a
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <ShieldCheck size={18} weight="bold" />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
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
            gap: '0.125rem',
          }}
          className="desktop-nav"
        >
          <a
            href="#how-it-works"
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            How It Works
          </a>
          <a
            href="#safety-architecture"
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            Safety
          </a>
          <a
            href="#trueforge-platform"
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            TrueForge
          </a>
          <a
            href="#interactive-proof"
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            Live Verification
          </a>
        </div>

        {/* Right: Status + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className={`badge ${healthConfig.badgeClass}`} title={healthConfig.tooltip}>
            <span className="status-indicator" />
            <span>{healthConfig.label}</span>
          </span>

          <button
            onClick={onOpenConsole}
            className="btn btn-primary"
            id="nav-cta-btn"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <TerminalWindow size={15} weight="bold" />
            <span>Launch Console</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
