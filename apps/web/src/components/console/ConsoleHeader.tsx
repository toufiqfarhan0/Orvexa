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
        if (isMounted) {
          setBackendHealth('offline');
        }
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
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0.625rem 1.5rem',
        backgroundColor: 'var(--bg-canvas)',
        borderBottom: '1px solid var(--border-dim)',
        transition: 'box-shadow 200ms ease',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Back + Brand breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
            style={{
              padding: '0.375rem 0.625rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
            }}
            title="Return to Orvexa Landing Page"
            aria-label="Return to overview"
          >
            <ArrowLeft size={15} />
            <span className="desktop-nav">Overview</span>
          </button>

          {/* Divider */}
          <div
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: 'var(--border-medium)',
              flexShrink: 0,
            }}
          />

          {/* Brand + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                backgroundColor: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <ShieldCheck size={15} weight="bold" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
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
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                / console
              </span>
            </div>
          </div>
        </div>

        {/* Right: Status + Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className={`badge ${healthConfig.badgeClass}`} title={healthConfig.tooltip}>
            <span className="status-indicator" />
            <span>{healthConfig.label}</span>
          </span>

          <button
            onClick={onOpenTelemetryModal}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
            title="Inspect Live Server Diagnostics"
          >
            <TerminalWindow size={14} />
            <span className="desktop-nav">Telemetry</span>
          </button>
        </div>
      </div>
    </header>
  );
};
