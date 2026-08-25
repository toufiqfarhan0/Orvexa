import React from 'react';
import { Database, ShieldCheck } from '@phosphor-icons/react';

interface TargetConfigPanelProps {
  targetDatabase?: string;
  targetSchema?: string;
  postgresVersion?: string;
  connectionStatus?: 'READY' | 'STANDBY' | 'CONNECTING';
}

export const TargetConfigPanel: React.FC<TargetConfigPanelProps> = ({
  targetDatabase = 'orvexa_target_db',
  targetSchema = 'public',
  postgresVersion = 'PostgreSQL 16',
  connectionStatus = 'READY',
}) => {
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
          className={`badge ${connectionStatus === 'READY' ? 'badge-success' : 'badge-neutral'}`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className="status-indicator" />
          <span>{connectionStatus}</span>
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
          <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.25rem' }}>
            {postgresVersion}
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
          <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.25rem' }}>
            {targetDatabase}
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
          <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.25rem' }}>
            {targetSchema}
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
          <div style={{ color: 'var(--status-success)', fontWeight: 500, marginTop: '0.25rem' }}>
            READ COMMITTED
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
        <span>Credentials sanitized. Target access gated by lock engine.</span>
      </div>
    </div>
  );
};
