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
    return () => {
      isMounted = false;
    };
  }, []);

  const healthConfig = getHealthDisplayConfig(backendHealth);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 'var(--nav-height)',
        backgroundColor: 'rgba(8, 9, 13, 0.92)',
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
        {/* Brand & Console Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
            style={{
              padding: '0.4rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
            }}
            title="Return to Orvexa Landing Page"
            aria-label="Return to overview"
          >
            <ArrowLeft size={16} />
            <span className="desktop-nav">Overview</span>
          </button>

          <div
            style={{
              width: '1px',
              height: '18px',
              backgroundColor: 'var(--border-subtle)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-btn)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <ShieldCheck size={18} weight="bold" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
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

        {/* Right Status Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Live Engine Status Chip */}
          <span className={`badge ${healthConfig.badgeClass}`} title={healthConfig.tooltip}>
            <span className="status-indicator" />
            <span style={{ textTransform: 'uppercase' }}>{healthConfig.label}</span>
          </span>

          {/* Telemetry Button */}
          <button
            onClick={onOpenTelemetryModal}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
            title="Inspect Live Server Diagnostics"
          >
            <TerminalWindow size={15} />
            <span className="desktop-nav">Telemetry</span>
          </button>
        </div>
      </div>
    </header>
  );
};
