import React from 'react';
import { FingerprintSimple } from '@phosphor-icons/react';
import type { MigrationSessionStatus } from '@orvexa/shared';

export type StepVisualState = 'completed' | 'current' | 'failed' | 'pending';

export function getStepVisualState(
  stepIndex: number,
  status: MigrationSessionStatus
): StepVisualState {
  switch (status) {
    case 'DRAFT':
      if (stepIndex === 0) return 'current';
      return 'pending';

    case 'ANALYZING':
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'current';
      return 'pending';

    case 'ANALYSIS_FAILED':
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'failed';
      return 'pending';

    case 'SANDBOX_READY':
    case 'SANDBOX_RUNNING':
      if (stepIndex <= 1) return 'completed';
      if (stepIndex === 2) return 'current';
      return 'pending';

    case 'SANDBOX_FAILED':
      if (stepIndex <= 1) return 'completed';
      if (stepIndex === 2) return 'failed';
      return 'pending';

    case 'SANDBOX_REHEARSAL_COMPLETED':
    case 'AWAITING_APPROVAL':
      if (stepIndex <= 2) return 'completed';
      if (stepIndex === 3) return 'current';
      return 'pending';

    case 'REJECTED':
      if (stepIndex <= 2) return 'completed';
      if (stepIndex === 3) return 'failed';
      return 'pending';

    case 'APPROVED':
    case 'EXECUTING':
    case 'VERIFYING':
      if (stepIndex <= 3) return 'completed';
      if (stepIndex === 4) return 'current';
      return 'pending';

    case 'EXECUTION_FAILED':
    case 'VERIFICATION_FAILED':
      if (stepIndex <= 3) return 'completed';
      if (stepIndex === 4) return 'failed';
      return 'pending';

    case 'COMPLETED':
      return 'completed';

    default:
      return stepIndex === 0 ? 'current' : 'pending';
  }
}

interface SessionStatusPanelProps {
  sessionId?: string;
  status: MigrationSessionStatus;
  createdAt?: string;
}

const LIFECYCLE_STEPS = [
  { label: 'Draft' },
  { label: 'Analysis' },
  { label: 'Rehearsal' },
  { label: 'Approval' },
  { label: 'Execution' },
];

export const SessionStatusPanel: React.FC<SessionStatusPanelProps> = ({
  sessionId,
  status = 'DRAFT',
  createdAt,
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

  const formattedCreatedAt = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not saved yet';

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
          <span
            style={{
              color: sessionId ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: sessionId ? '0.8125rem' : '0.75rem',
            }}
          >
            {sessionId || 'Unsaved Local Draft'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>CREATED AT</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {formattedCreatedAt}
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
          {LIFECYCLE_STEPS.map((step, idx) => {
            const stepState = getStepVisualState(idx, status);

            let barColor = 'var(--border-dim)';
            let textColor = 'var(--text-muted)';
            let fontWeight = 400;

            if (stepState === 'completed') {
              barColor = 'var(--status-success)';
              textColor = 'var(--status-success)';
              fontWeight = 500;
            } else if (stepState === 'current') {
              barColor = 'var(--accent)';
              textColor = 'var(--accent)';
              fontWeight = 600;
            } else if (stepState === 'failed') {
              barColor = 'var(--status-error)';
              textColor = 'var(--status-error)';
              fontWeight = 600;
            }

            return (
              <div
                key={step.label}
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
                    backgroundColor: barColor,
                    transition: 'background-color var(--duration-normal)',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    color: textColor,
                    fontWeight,
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
