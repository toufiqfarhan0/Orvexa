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

/* Original shield logo mark */
const BrandLogo = () => (
  <div
    style={{
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      backgroundColor: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
    }}
  >
    <ShieldCheck size={16} weight="bold" />
  </div>
);

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
        if (isMounted) setBackendHealth('offline');
      }
    };

    checkHealth();

    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMounted = false;
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const healthConfig = getHealthDisplayConfig(backendHealth);

  return (
    <nav className="nav-wrap">
      <div className={`nav-inner${scrolled ? ' scrolled' : ''}`}>
        {/* Brand */}
        <a
          href="#"
          className="nav-logo"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
        >
          <BrandLogo />
          <span className="nav-logo-text">Orvexa</span>
        </a>

        {/* Desktop links */}
        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">
            How It Works
          </a>
          <a href="#safety-architecture" className="nav-link">
            Safety
          </a>
          <a href="#integrations" className="nav-link">
            Integrations
          </a>
          <a href="#interactive-proof" className="nav-link">
            Live Demo
          </a>
        </div>

        {/* Right: health + CTA */}
        <div className="nav-right">
          <span className={`badge ${healthConfig.badgeClass}`} title={healthConfig.tooltip}>
            <span className="dot dot-pulse" />
            <span className="nav-health-label">{healthConfig.label}</span>
          </span>

          <button
            onClick={onOpenConsole}
            className="btn btn-primary"
            id="nav-cta-btn"
            style={{ padding: '0.5rem 1.125rem', fontSize: '0.875rem' }}
          >
            <TerminalWindow size={14} weight="bold" />
            <span className="desktop-cta-label">Launch Console</span>
            <span className="mobile-cta-label">Console</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
