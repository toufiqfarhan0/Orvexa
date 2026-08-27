import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, TerminalWindow } from '@phosphor-icons/react';
import type { HealthCheckResponse } from '@orvexa/shared';
import {
  mapHealthStatus,
  getHealthDisplayConfig,
  type BackendHealthState,
} from '../../utils/health.js';
import { useRouter } from '../../router/Router.js';

interface ConsoleHeaderProps {
  onOpenTelemetryModal: () => void;
}

/* Original shield logo mark */
const BrandLogo = () => (
  <div
    style={{
      width: '24px',
      height: '24px',
      borderRadius: '7px',
      backgroundColor: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
    }}
  >
    <ShieldCheck size={14} weight="bold" />
  </div>
);

export const ConsoleHeader: React.FC<ConsoleHeaderProps> = ({ onOpenTelemetryModal }) => {
  const { navigate } = useRouter();
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

    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMounted = false;
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const healthConfig = getHealthDisplayConfig(backendHealth);

  return (
    <header
      className="console-header-wrapper"
      style={{
        boxShadow: scrolled ? '0 1px 8px rgba(15,15,40,0.07)' : 'none',
      }}
    >
      <div className="console-header-container">
        {/* Left: Back + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.35rem 0.625rem',
              borderRadius: '999px',
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              flexShrink: 0,
              transition: 'background 120ms, color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Return to overview"
            aria-label="Return to overview"
          >
            <ArrowLeft size={14} />
            <span className="desktop-nav">Overview</span>
          </button>

          {/* Divider */}
          <div className="console-header-divider" />

          {/* Brand breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <BrandLogo />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  letterSpacing: '-0.03em',
                  color: 'var(--text-primary)',
                }}
              >
                Orvexa
              </span>
              <span className="console-breadcrumb-subtitle">/ console</span>
            </div>
          </div>
        </div>

        {/* Right: Health badge + Telemetry button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span className={`badge ${healthConfig.badgeClass}`} title={healthConfig.tooltip}>
            <span className="dot dot-pulse" />
            <span className="console-health-label">{healthConfig.label}</span>
          </span>

          <button
            onClick={onOpenTelemetryModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(15,15,40,0.04)',
              transition: 'background 120ms, border-color 120ms, color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Inspect Live Server Diagnostics"
          >
            <TerminalWindow size={13} />
            <span className="desktop-nav">Telemetry</span>
          </button>
        </div>
      </div>
    </header>
  );
};
