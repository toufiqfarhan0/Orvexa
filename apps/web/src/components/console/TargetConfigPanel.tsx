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
    <div className="c-card">
      {/* Target Panel Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <Database size={16} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Target Environment
          </h3>
        </div>
        <span
          className={`badge ${isConnected ? 'badge-green' : 'badge-neutral'}`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className={`dot ${isConnected ? 'dot-pulse' : ''}`} />
          <span>{isConnected ? connectionStatus : 'NOT CONNECTED'}</span>
        </span>
      </div>

      {/* Target Properties Grid */}
      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
      >
        <div className="target-grid">
          {/* Engine Version */}
          <div className="target-cell">
            <div className="target-cell-key">ENGINE</div>
            <div className="target-cell-val" style={{ fontFamily: 'var(--font-mono)' }}>
              {postgresVersion || 'Not inspected'}
            </div>
          </div>

          {/* Database Catalog */}
          <div className="target-cell">
            <div className="target-cell-key">CATALOG</div>
            <div className="target-cell-val" style={{ fontFamily: 'var(--font-mono)' }}>
              {targetDatabase || 'Not selected'}
            </div>
          </div>

          {/* Target Schema */}
          <div className="target-cell">
            <div className="target-cell-key">SCHEMA</div>
            <div className="target-cell-val" style={{ fontFamily: 'var(--font-mono)' }}>
              {targetSchema || 'Unassigned'}
            </div>
          </div>

          {/* Isolation Level */}
          <div className="target-cell">
            <div className="target-cell-key">ISOLATION</div>
            <div
              className="target-cell-val"
              style={{
                fontFamily: 'var(--font-mono)',
                color: isConnected ? 'var(--green)' : 'var(--text-muted)',
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
    </div>
  );
};
