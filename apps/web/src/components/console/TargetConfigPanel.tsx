import React from 'react';
import { Database, ShieldCheck } from '@phosphor-icons/react';

interface TargetConfigPanelProps {
  targetDatabase?: string;
  targetSchema?: string;
  postgresVersion?: string;
  connectionStatus?: 'CONNECTED' | 'READY' | 'STANDBY' | 'CONNECTING' | 'NOT_CONFIGURED';
}

export const TargetConfigPanel: React.FC<TargetConfigPanelProps> = ({
  targetDatabase,
  targetSchema,
  postgresVersion,
  connectionStatus = 'NOT_CONFIGURED',
}) => {
  const isConnected = connectionStatus === 'READY' || connectionStatus === 'CONNECTED';

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Target Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Target Environment</h3>
        </div>
        <span
          className={`badge ${isConnected ? 'badge-success' : 'badge-neutral'}`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className="status-indicator" />
          <span>{isConnected ? connectionStatus : 'Not Connected'}</span>
        </span>
      </div>

      {/* Target Properties Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
        }}
      >
        {/* Engine Version */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>ENGINE</div>
          <div
            style={{
              color: postgresVersion ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
              marginTop: '0.25rem',
            }}
          >
            {postgresVersion || 'Not inspected'}
          </div>
        </div>

        {/* Database Catalog */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>CATALOG</div>
          <div
            style={{
              color: targetDatabase ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
              marginTop: '0.25rem',
            }}
          >
            {targetDatabase || 'Not selected'}
          </div>
        </div>

        {/* Target Schema */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>SCHEMA</div>
          <div
            style={{
              color: targetSchema ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 500,
              marginTop: '0.25rem',
            }}
          >
            {targetSchema || 'Unassigned'}
          </div>
        </div>

        {/* Isolation Level */}
        <div
          style={{
            padding: '0.625rem 0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>ISOLATION</div>
          <div
            style={{
              color: isConnected ? 'var(--status-success)' : 'var(--text-muted)',
              fontWeight: 500,
              marginTop: '0.25rem',
            }}
          >
            {isConnected ? 'READ COMMITTED' : 'Not configured'}
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          paddingTop: '0.25rem',
        }}
      >
        <ShieldCheck size={16} color="var(--accent)" />
        <span>
          {isConnected
            ? 'Credentials sanitized. Target access gated by lock engine.'
            : 'Target connection requires server configuration.'}
        </span>
      </div>
    </div>
  );
};
