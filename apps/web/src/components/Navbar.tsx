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
    <nav className="navbar-wrapper">
      <div
        className="navbar-pill-container"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.82)',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
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
            flexShrink: 0,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span
            className={`badge ${healthConfig.badgeClass}`}
            title={healthConfig.tooltip}
            style={{ flexShrink: 0 }}
          >
            <span className="status-indicator" />
            <span className="nav-health-label">{healthConfig.label}</span>
          </span>

          <button
            onClick={onOpenConsole}
            className="btn btn-primary navbar-cta-btn"
            id="nav-cta-btn"
            style={{ flexShrink: 0 }}
          >
            <TerminalWindow size={15} weight="bold" />
            <span className="desktop-cta-label">Launch Console</span>
            <span className="mobile-cta-label">Console</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
