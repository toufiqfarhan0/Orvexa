import React, { useState, useEffect } from 'react';
import { X, TerminalWindow, ArrowsClockwise } from '@phosphor-icons/react';
import type { HealthCheckResponse } from '@orvexa/shared';
import { mapHealthStatus, getHealthDisplayConfig } from '../utils/health.js';

interface MigrationConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MigrationConsoleModal: React.FC<MigrationConsoleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const healthRes = await fetch('/api/health');
      if (!healthRes.ok) {
        throw new Error(`Health check failed: HTTP ${healthRes.status}`);
      }
      const healthData: HealthCheckResponse = await healthRes.json();
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(4, 5, 8, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel-elevated"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TerminalWindow size={20} color="var(--accent)" weight="bold" />
            <h2 id="modal-title" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Orvexa Engine Telemetry
            </h2>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost btn"
            aria-label="Close telemetry modal"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-btn)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Live engine probes and active MCP tool registrations
            </span>
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="btn btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
            >
              <ArrowsClockwise size={14} />
              <span>{loading ? 'Probing...' : 'Refresh Telemetry'}</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--status-error-bg)',
                border: '1px solid var(--status-error-border)',
                borderRadius: 'var(--radius-card)',
                color: 'var(--status-error)',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                Backend Connectivity Alert
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{error}</p>
            </div>
          )}

          {/* Engine Status Grid */}
          {health && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  SERVICE
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {health.service}
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  STATUS
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: getHealthDisplayConfig(mapHealthStatus(health.status)).colorVar,
                    marginTop: '0.25rem',
                  }}
                >
                  {health.status.toUpperCase()}
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  UPTIME
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {health.uptime}s
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ENVIRONMENT
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {health.environment}
                </div>
              </div>
            </div>
          )}

          {/* Active MCP Tools Surface */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              REGISTERED CORE ENGINE TOOL INTERFACES
            </div>
            <div className="code-block" style={{ fontSize: '0.8125rem' }}>
              <div>[MCP] inspect_database (Read-only schema inspection)</div>
              <div>[MCP] analyze_migration (AST classification and lock evaluator)</div>
              <div>[MCP] rehearse_migration (Daytona sandbox ephemeral database)</div>
              <div>[MCP] request_approval (SHA-256 fingerprint generation)</div>
              <div>[MCP] record_approval (Cryptographic signature commit)</div>
              <div>[MCP] execute_live_migration (Atomic target execution)</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-dim)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};
