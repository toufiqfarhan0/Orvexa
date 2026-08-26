import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Fingerprint, LockKey } from '@phosphor-icons/react';
import type { ApiSessionData } from '../../services/migration-api.service.js';

interface ApprovalGatePanelProps {
  session: ApiSessionData;
  isSubmitting?: boolean;
  onApprove: (approver: string, comment?: string) => Promise<void>;
  onReject: (approver: string, rejectionReason: string) => Promise<void>;
}

export const ApprovalGatePanel: React.FC<ApprovalGatePanelProps> = ({
  session,
  isSubmitting = false,
  onApprove,
  onReject,
}) => {
  const [approver, setApprover] = useState<string>('LeadDBA');
  const [comment, setComment] = useState<string>(
    'Verified zero schema mutations on target and clean rehearsal metrics.'
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const approvalRequest = session.approvalRequest;
  const approvalDecision = session.approvalDecision;
  const status = session.status;

  const handleApprove = async () => {
    if (!approver.trim()) {
      setValidationError('Approver identifier (name or email) is required.');
      return;
    }
    setValidationError(null);
    await onApprove(approver.trim(), comment.trim() || undefined);
  };

  const handleReject = async () => {
    if (!approver.trim()) {
      setValidationError('Approver identifier (name or email) is required.');
      return;
    }
    if (!comment.trim()) {
      setValidationError('A rejection reason must be provided when rejecting a migration.');
      return;
    }
    setValidationError(null);
    await onReject(approver.trim(), comment.trim());
  };

  // Render APPROVED Decision State
  if (status === 'APPROVED' && approvalDecision) {
    return (
      <div
        className="panel"
        id="approval-decision-panel"
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          backgroundColor: 'rgba(34, 197, 94, 0.04)',
        }}
      >
        {/* Banner */}
        <div
          id="approval-decision-banner"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-success)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} weight="bold" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Migration Approved for Execution
              </h3>
              <span
                className="badge"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--status-success)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                APPROVED
              </span>
            </div>
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                marginTop: '0.25rem',
              }}
            >
              Cryptographically verified human approval recorded. Target database execution is
              guarded.
            </div>
          </div>
        </div>

        {/* Decision Evidence Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
            fontSize: '0.8125rem',
          }}
        >
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
              }}
            >
              Approver
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {approvalDecision.approver}
            </div>
          </div>
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
              }}
            >
              Decided At
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
              }}
            >
              {new Date(approvalDecision.decidedAt).toLocaleString()}
            </div>
          </div>
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
              }}
            >
              Decision ID
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                marginTop: '0.25rem',
              }}
            >
              {approvalDecision.decisionId}
            </div>
          </div>
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
              }}
            >
              Rehearsal ID
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                marginTop: '0.25rem',
              }}
            >
              {approvalDecision.rehearsalId}
            </div>
          </div>
        </div>

        {/* Comment */}
        {approvalDecision.comment && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-card)',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Approval Note: </span>
            <span style={{ color: 'var(--text-primary)' }}>{approvalDecision.comment}</span>
          </div>
        )}

        {/* Cryptographic Seal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Fingerprint size={18} color="var(--accent)" />
          <div
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>SHA-256 Seal: </span>
            <span id="approval-fingerprint" style={{ color: 'var(--accent)' }}>
              {approvalDecision.fingerprint}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render REJECTED Decision State
  if (status === 'REJECTED' && approvalDecision) {
    return (
      <div
        className="panel"
        id="rejection-decision-panel"
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
        }}
      >
        {/* Banner */}
        <div
          id="rejection-decision-banner"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-error)',
              flexShrink: 0,
            }}
          >
            <XCircle size={24} weight="bold" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Migration Rejected by Approver
              </h3>
              <span
                className="badge"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--status-error)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                REJECTED
              </span>
            </div>
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                marginTop: '0.25rem',
              }}
            >
              This migration proposal has been rejected and will not proceed to target execution.
            </div>
          </div>
        </div>

        {/* Rejection Details */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
              }}
            >
              Rejected By:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{approvalDecision.approver}</strong>
            </span>
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {new Date(approvalDecision.decidedAt).toLocaleString()}
            </span>
          </div>
          <div style={{ color: 'var(--status-error)', fontWeight: 500 }}>
            {approvalDecision.rejectionReason || 'No explicit reason provided.'}
          </div>
        </div>
      </div>
    );
  }

  // Render AWAITING_APPROVAL Gate Panel
  return (
    <div
      className="panel"
      id="approval-gate-panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        backgroundColor: 'rgba(245, 158, 11, 0.03)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-dim)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-warning)',
              flexShrink: 0,
            }}
          >
            <LockKey size={18} weight="bold" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Human Approval Required
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Awaiting explicit engineer or DBA sign-off before execution gate unlocks.
            </div>
          </div>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--status-warning)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            fontSize: '0.6875rem',
            fontWeight: 600,
          }}
        >
          AWAITING_APPROVAL
        </span>
      </div>

      {/* Rehearsal & Risk Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
            }}
          >
            Overall Risk Level
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              marginTop: '0.25rem',
              color:
                approvalRequest?.highestRiskLevel === 'CRITICAL'
                  ? 'var(--status-error)'
                  : approvalRequest?.highestRiskLevel === 'HIGH'
                    ? 'var(--status-warning)'
                    : 'var(--status-success)',
            }}
          >
            {approvalRequest?.highestRiskLevel || session.riskAssessment?.overallRiskLevel || 'LOW'}
          </div>
        </div>

        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
            }}
          >
            Target Database
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
            }}
          >
            {session.target?.databaseName || 'schemasentry_test'}.
            {session.target?.schemaName || 'public'}
          </div>
        </div>

        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
            }}
          >
            Target Isolation
          </div>
          <div
            id="approval-gate-target-isolation"
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color:
                session.rehearsalEvidence?.targetUntouched === true &&
                session.sandboxResult?.status === 'SUCCESS'
                  ? 'var(--status-success)'
                  : 'var(--status-warning)',
              marginTop: '0.25rem',
            }}
          >
            {session.rehearsalEvidence?.targetUntouched === true &&
            session.sandboxResult?.status === 'SUCCESS'
              ? '✓ Verified Untouched'
              : '⚠️ Verification Required / Unverified'}
          </div>
        </div>
      </div>

      {/* Reasons / Risk Context */}
      {approvalRequest?.reasonsRequired && approvalRequest.reasonsRequired.length > 0 && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            Review Requirements:
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {approvalRequest.reasonsRequired.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cryptographic Fingerprint Display */}
      {approvalRequest?.fingerprint && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
            }}
          >
            <Fingerprint size={14} color="var(--accent)" />
            <span>Cryptographic Approval Fingerprint (SHA-256)</span>
          </div>
          <div
            id="approval-fingerprint"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--accent)',
              backgroundColor: 'var(--bg-surface)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-dim)',
              wordBreak: 'break-all',
            }}
          >
            {approvalRequest.fingerprint}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Deterministically binds this approval to migration SQL, target identity, and rehearsal
            results.
          </div>
        </div>
      )}

      {/* Interactive Review Form */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-canvas)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <div>
          <label
            htmlFor="approver-input"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem',
            }}
          >
            Approver Identifier *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="approver-input"
              type="text"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="e.g. LeadDBA / alice@company.com"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-card)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="approval-comment-input"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem',
            }}
          >
            Review Comment / Rejection Reason
          </label>
          <textarea
            id="approval-comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add verification notes or rejection justification..."
            disabled={isSubmitting}
            rows={2}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              fontSize: '0.8125rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-card)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Validation error display */}
        {validationError && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--status-error)',
              fontWeight: 500,
            }}
          >
            {validationError}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            id="reject-migration-btn"
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: 'var(--status-error)',
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            <XCircle size={16} />
            <span>Reject Migration</span>
          </button>

          <button
            id="approve-migration-btn"
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8125rem',
              backgroundColor: 'var(--status-success)',
              borderColor: 'var(--status-success)',
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            <CheckCircle size={16} weight="bold" />
            <span>{isSubmitting ? 'Recording Decision...' : 'Approve Migration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
