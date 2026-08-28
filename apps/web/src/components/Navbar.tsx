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

/* Original shield logo mark with refined high-precision geometry */
const BrandLogo: React.FC = () => (
  <div
    style={{
      width: '32px',
      height: '32px',
      borderRadius: '9px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}
  >
    <ShieldCheck size={18} weight="bold" />
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
    <header className="nav-wrap">
      <nav className={`nav-inner${scrolled ? ' scrolled' : ''}`} aria-label="Main Navigation">
        {/* Brand Identity */}
        <a
          href="#"
          className="nav-logo"
          aria-label="Orvexa Home"
        >
          <BrandLogo />
          <span className="nav-logo-text">Orvexa</span>
        </a>

        {/* Desktop Links */}
        <div className="nav-links desktop-nav">
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

        {/* Right: Telemetry Health + Action CTA */}
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
            <TerminalWindow size={15} weight="bold" />
            <span className="desktop-cta-label">Launch Console</span>
            <span className="mobile-cta-label">Console</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
