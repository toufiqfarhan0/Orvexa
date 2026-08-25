import React from 'react';
import { ShieldWarning, ListMagnifyingGlass } from '@phosphor-icons/react';

interface RiskPreviewPanelProps {
  hasAnalysis?: boolean;
}

export const RiskPreviewPanel: React.FC<RiskPreviewPanelProps> = ({ hasAnalysis = false }) => {
  return (
    <div
      className="panel-elevated"
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
          <ShieldWarning size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Risk Evaluation</h3>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
          {hasAnalysis ? 'Analyzed' : 'Pending Analysis'}
        </span>
      </div>

      {/* Content Area */}
      {!hasAnalysis ? (
        <div
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            backgroundColor: '#06070a',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ListMagnifyingGlass size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              No analysis yet
            </div>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                maxWidth: '44ch',
                margin: '0 auto',
                lineHeight: 1.5,
              }}
            >
              Enter a migration script and click Analyze Migration to evaluate lock impacts, data
              integrity risks, and sandbox rehearsal requirements.
            </p>
          </div>
        </div>
      ) : null}

      {/* 5 Risk Dimensions Framework (Reference Layout) */}
      <div>
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '0.5rem',
          }}
        >
          ANALYSIS DIMENSIONS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {[
            { label: 'LOCKING', desc: 'Table locks & concurrency' },
            { label: 'DATA_INTEGRITY', desc: 'Destructive DDL checks' },
            { label: 'PERFORMANCE', desc: 'Sequential scan risks' },
            { label: 'ROLLBACK', desc: 'Transaction reversibility' },
            { label: 'COMPATIBILITY', desc: 'PostgreSQL catalog rules' },
          ].map((dim) => (
            <div
              key={dim.label}
              style={{
                padding: '0.5rem 0.625rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-badge)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{dim.label}</div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.125rem',
                }}
              >
                {dim.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
