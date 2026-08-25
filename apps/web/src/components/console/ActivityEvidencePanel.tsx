import React from 'react';
import { Scroll, Clock } from '@phosphor-icons/react';

interface ActivityEvidencePanelProps {
  status?: string;
}

export const ActivityEvidencePanel: React.FC<ActivityEvidencePanelProps> = ({
  status = 'DRAFT',
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
      {/* Header */}
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
          <Scroll size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Audit & Evidence Log</h3>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
          Real Time
        </span>
      </div>

      {/* Activity Timeline List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Initial Event */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0,
              marginTop: '0.125rem',
            }}
          >
            <Clock size={12} />
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Session Initialized</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              Migration session created in {status} mode. Ready for DDL script input.
            </div>
          </div>
        </div>

        {/* Informational Guidance */}
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(34, 211, 238, 0.03)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-card)',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.25rem' }}>
            Verification Invariants
          </div>
          <div>
            Every action produces SHA-256 fingerprint evidence recorded during rehearsal, approval
            gate sign-off, and execution lock enforcement.
          </div>
        </div>
      </div>
    </div>
  );
};
