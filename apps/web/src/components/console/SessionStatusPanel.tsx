import React from 'react';
import { FingerprintSimple } from '@phosphor-icons/react';
import type { MigrationSessionStatus } from '@orvexa/shared';

interface SessionStatusPanelProps {
  sessionId?: string;
  status: MigrationSessionStatus;
  createdAt?: string;
}

const LIFECYCLE_STEPS: { key: MigrationSessionStatus; label: string }[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SANDBOX_READY', label: 'Analyzed' },
  { key: 'SANDBOX_REHEARSAL_COMPLETED', label: 'Rehearsed' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'COMPLETED', label: 'Executed' },
];

export const SessionStatusPanel: React.FC<SessionStatusPanelProps> = ({
  sessionId = 'sess-active-draft',
  status = 'DRAFT',
  createdAt = new Date().toISOString(),
}) => {
  const getStatusBadgeClass = (s: MigrationSessionStatus) => {
    switch (s) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'SANDBOX_REHEARSAL_COMPLETED':
      case 'SANDBOX_READY':
        return 'badge-success';
      case 'ANALYZING':
      case 'SANDBOX_RUNNING':
      case 'AWAITING_APPROVAL':
      case 'EXECUTING':
      case 'VERIFYING':
        return 'badge-warning';
      case 'ANALYSIS_FAILED':
      case 'SANDBOX_FAILED':
      case 'REJECTED':
      case 'EXECUTION_FAILED':
      case 'VERIFICATION_FAILED':
        return 'badge-error';
      case 'DRAFT':
      default:
        return 'badge-neutral';
    }
  };

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
          <FingerprintSimple size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Migration Session</h3>
        </div>
        <span className={`badge ${getStatusBadgeClass(status)}`} style={{ fontSize: '0.6875rem' }}>
          <span className="status-indicator" />
          <span>{status}</span>
        </span>
      </div>

      {/* Session Metadata */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>SESSION ID</span>
          <span style={{ color: 'var(--text-primary)' }}>{sessionId}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>CREATED AT</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Lifecycle Progressive Pipeline Bar */}
      <div style={{ paddingTop: '0.5rem' }}>
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '0.5rem',
          }}
        >
          LIFECYCLE PIPELINE
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.25rem',
            position: 'relative',
          }}
        >
          {LIFECYCLE_STEPS.map((step) => {
            const isCurrent = step.key === status;
            const isPast = status === 'COMPLETED';

            return (
              <div
                key={step.key}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: isCurrent
                      ? 'var(--accent)'
                      : isPast
                        ? 'var(--status-success)'
                        : 'var(--border-dim)',
                    transition: 'background-color var(--duration-normal)',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    color: isCurrent
                      ? 'var(--accent)'
                      : isPast
                        ? 'var(--status-success)'
                        : 'var(--text-muted)',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
