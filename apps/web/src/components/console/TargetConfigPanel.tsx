import React from 'react';
import { Database, ShieldCheck } from '@phosphor-icons/react';

interface TargetConfigPanelProps {
  targetDatabase?: string;
  targetSchema?: string;
  postgresVersion?: string;
  connectionStatus?: 'CONNECTED' | 'READY' | 'STANDBY' | 'CONNECTING' | 'NOT_CONFIGURED';
}

export const TargetConfigPanel: React.FC<TargetConfigPanelProps> = ({
  targetDatabase = 'schemasentry_test',
  targetSchema = 'public',
  postgresVersion = 'PostgreSQL 16',
  connectionStatus = 'READY',
}) => {
  const isConnected = connectionStatus === 'READY' || connectionStatus === 'CONNECTED';

  return (
    <div className="c-card">
      {/* Target Panel Header */}
      <div className="c-card-header" style={{ padding: '0.75rem 0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div className="c-icon-box" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
            <Database size={15} color="var(--accent)" weight="bold" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Target Environment
            </h3>
            <div
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginTop: '0.1rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {postgresVersion || 'PostgreSQL 16'}
            </div>
          </div>
        </div>
        <span
          className={`badge ${isConnected ? 'badge-green' : 'badge-neutral'}`}
          style={{ fontSize: '0.625rem', padding: '0.2rem 0.5rem', flexShrink: 0 }}
        >
          <span className={`dot ${isConnected ? 'dot-pulse' : ''}`} />
          <span>{isConnected ? connectionStatus : 'NOT CONNECTED'}</span>
        </span>
      </div>

      {/* Target Properties Grid */}
      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', padding: '0.875rem' }}
      >
        <div className="target-grid">
          {/* Engine Version */}
          <div className="c-param-capsule">
            <div className="c-param-key">ENGINE</div>
            <div className="c-param-val" title={postgresVersion || 'PostgreSQL 16'}>
              {postgresVersion || 'PostgreSQL 16'}
            </div>
          </div>

          {/* Database Catalog */}
          <div className="c-param-capsule">
            <div className="c-param-key">CATALOG</div>
            <div className="c-param-val" title={targetDatabase || 'schemasentry_test'}>
              {targetDatabase || 'schemasentry_test'}
            </div>
          </div>

          {/* Target Schema */}
          <div className="c-param-capsule">
            <div className="c-param-key">SCHEMA</div>
            <div className="c-param-val" title={targetSchema || 'public'}>
              {targetSchema || 'public'}
            </div>
          </div>

          {/* Isolation Level */}
          <div className="c-param-capsule">
            <div className="c-param-key">ISOLATION</div>
            <div
              className="c-param-val"
              style={{ color: isConnected ? 'var(--green)' : 'var(--text-muted)' }}
              title={isConnected ? 'READ COMMITTED' : 'Not configured'}
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
            gap: '0.45rem',
            fontSize: '0.6875rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-recessed)',
            padding: '0.45rem 0.65rem',
            borderRadius: '8px',
            border: '1px solid var(--border-dim)',
            lineHeight: 1.35,
          }}
        >
          <ShieldCheck size={14} color="var(--green)" weight="bold" style={{ flexShrink: 0 }} />
          <span>Protected by deterministic lock evaluator & sandbox.</span>
        </div>
      </div>
    </div>
  );
};
