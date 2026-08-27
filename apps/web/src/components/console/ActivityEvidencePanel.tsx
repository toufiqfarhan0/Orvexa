import React from 'react';
import { Scroll, Clock, CheckCircle, ShieldCheck } from '@phosphor-icons/react';
import type { ApiSessionData } from '../../services/migration-api.service.js';

interface ActivityEvidencePanelProps {
  status?: string;
  history?: ApiSessionData['history'];
}

export const ActivityEvidencePanel: React.FC<ActivityEvidencePanelProps> = ({
  status = 'DRAFT',
  history = [],
}) => {
  return (
    <div className="c-card">
      {/* Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <Scroll size={16} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Audit & Evidence Log
          </h3>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
          REAL TIME
        </span>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Activity Timeline List */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history && history.length > 0 ? (
            history.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="audit-entry">
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--green-bg)',
                    border: '1px solid var(--green-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--green)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <CheckCircle size={12} weight="bold" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                      }}
                    >
                      {entry.toStatus}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      marginTop: '0.125rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {entry.reason || `Actor: ${entry.actor || 'system'}`}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="audit-entry">
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--accent-light)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <Clock size={12} weight="bold" />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8125rem' }}
                >
                  Session Initialized
                </div>
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    marginTop: '0.125rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Migration session active in {status} mode. Ready for DDL probe.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Informational Guidance */}
        <div
          style={{
            padding: '0.75rem 0.875rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-faint)',
            borderRadius: '10px',
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              color: 'var(--accent)',
              fontWeight: 700,
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <ShieldCheck size={14} />
            <span>Verification Invariants</span>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Every action produces SHA-256 fingerprint evidence recorded during rehearsal, approval
            gate sign-off, and execution lock enforcement.
          </div>
        </div>
      </div>
    </div>
  );
};
