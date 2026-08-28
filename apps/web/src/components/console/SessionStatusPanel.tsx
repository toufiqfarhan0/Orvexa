import React, { useState } from 'react';
import { FingerprintSimple, Copy, Check } from '@phosphor-icons/react';
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
  { num: '01', name: 'Draft' },
  { num: '02', name: 'Analysis' },
  { num: '03', name: 'Rehearsal' },
  { num: '04', name: 'Approval' },
  { num: '05', name: 'Execution' },
];

export const SessionStatusPanel: React.FC<SessionStatusPanelProps> = ({
  sessionId,
  status = 'DRAFT',
  createdAt,
}) => {
  const [copied, setCopied] = useState(false);

  const formatStatusLabel = (s: MigrationSessionStatus): string => {
    switch (s) {
      case 'DRAFT':
        return 'DRAFT';
      case 'ANALYZING':
        return 'ANALYZING';
      case 'ANALYSIS_FAILED':
        return 'ANALYSIS FAILED';
      case 'SANDBOX_READY':
        return 'READY';
      case 'SANDBOX_RUNNING':
        return 'REHEARSING';
      case 'SANDBOX_FAILED':
        return 'REHEARSAL FAILED';
      case 'SANDBOX_REHEARSAL_COMPLETED':
        return 'REHEARSED';
      case 'AWAITING_APPROVAL':
        return 'APPROVAL REQ';
      case 'APPROVED':
        return 'APPROVED';
      case 'REJECTED':
        return 'REJECTED';
      case 'EXECUTING':
        return 'EXECUTING';
      case 'EXECUTION_FAILED':
        return 'EXEC FAILED';
      case 'VERIFYING':
        return 'VERIFYING';
      case 'VERIFICATION_FAILED':
        return 'VERIFY FAILED';
      case 'COMPLETED':
        return 'COMPLETED';
      default:
        return String(s || 'DRAFT').replace(/_/g, ' ');
    }
  };

  const getStatusBadgeClass = (s: MigrationSessionStatus) => {
    switch (s) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'SANDBOX_REHEARSAL_COMPLETED':
      case 'SANDBOX_READY':
        return 'badge-green';
      case 'ANALYZING':
      case 'SANDBOX_RUNNING':
      case 'AWAITING_APPROVAL':
      case 'EXECUTING':
      case 'VERIFYING':
        return 'badge-amber';
      case 'ANALYSIS_FAILED':
      case 'SANDBOX_FAILED':
      case 'REJECTED':
      case 'EXECUTION_FAILED':
      case 'VERIFICATION_FAILED':
        return 'badge-red';
      case 'DRAFT':
      default:
        return 'badge-neutral';
    }
  };

  const handleCopySessionId = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const formattedCreatedAt = createdAt
    ? new Date(createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Not saved yet';

  return (
    <div className="c-card">
      {/* Header */}
      <div className="c-card-header" style={{ padding: '0.75rem 0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div className="c-icon-box" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
            <FingerprintSimple size={15} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Migration Session
          </h3>
        </div>
        <span
          className={`badge ${getStatusBadgeClass(status)}`}
          style={{
            fontSize: '0.625rem',
            padding: '0.2rem 0.5rem',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={status}
        >
          <span className="dot dot-pulse" />
          <span>{formatStatusLabel(status)}</span>
        </span>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Metadata Rows */}
        <div>
          <div className="c-meta-row">
            <span className="c-meta-key">SESSION ID</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
              <span
                className="c-meta-val primary"
                style={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '180px',
                  fontFamily: 'var(--font-mono)',
                }}
                title={sessionId || 'Unsaved Draft'}
              >
                {sessionId ? `${sessionId.slice(0, 8)}…${sessionId.slice(-6)}` : 'Unsaved Draft'}
              </span>
              {sessionId && (
                <button
                  type="button"
                  onClick={handleCopySessionId}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.15rem',
                    cursor: 'pointer',
                    color: copied ? 'var(--green)' : 'var(--text-muted)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Copy full Session ID"
                >
                  {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          <div className="c-meta-row">
            <span className="c-meta-key">CREATED AT</span>
            <span className="c-meta-val">{formattedCreatedAt}</span>
          </div>
        </div>

        {/* Lifecycle Progressive Pipeline Track */}
        <div>
          <div
            style={{
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.375rem',
            }}
          >
            LIFECYCLE PIPELINE
          </div>

          <div className="lifecycle-track">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const stepState = getStepVisualState(idx, status);
              return (
                <div key={step.num} className={`lifecycle-step ls-${stepState}`}>
                  <div className="lifecycle-step-bar" />
                  <span className="lifecycle-step-num">{step.num}</span>
                  <span className="lifecycle-step-name">{step.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
