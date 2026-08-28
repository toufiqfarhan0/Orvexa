import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Fingerprint, LockKey, WarningCircle } from '@phosphor-icons/react';
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
        className="c-card"
        id="approval-decision-panel"
        style={{
          border: '1px solid var(--green-border)',
          background: 'var(--green-bg)',
        }}
      >
        <div className="c-card-header" style={{ background: 'rgba(22, 163, 74, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--green-bg)',
                border: '1px solid var(--green-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--green)',
              }}
            >
              <ShieldCheck size={18} weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Migration Approved for Execution
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Cryptographically verified human approval recorded.
              </div>
            </div>
          </div>
          <span className="badge badge-green">APPROVED</span>
        </div>

        <div
          className="c-card-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Decision Evidence Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              padding: '1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
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
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Decided At
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
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
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Decision ID
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  wordBreak: 'break-all',
                }}
              >
                {approvalDecision.decisionId}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Rehearsal ID
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  wordBreak: 'break-all',
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
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: '10px',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Approval Note: </span>
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Fingerprint size={18} color="var(--accent)" />
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>SHA-256 Seal: </span>
              <span id="approval-fingerprint" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {approvalDecision.fingerprint}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render REJECTED Decision State
  if (status === 'REJECTED' && approvalDecision) {
    return (
      <div
        className="c-card"
        id="rejection-decision-panel"
        style={{
          border: '1px solid var(--red-border)',
          background: 'var(--red-bg)',
        }}
      >
        <div className="c-card-header" style={{ background: 'rgba(220, 38, 38, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--red-bg)',
                border: '1px solid var(--red-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--red)',
              }}
            >
              <XCircle size={18} weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Migration Rejected by Approver
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                This proposal was rejected and will not proceed to live execution.
              </div>
            </div>
          </div>
          <span className="badge badge-red">REJECTED</span>
        </div>

        <div className="c-card-body">
          <div
            style={{
              padding: '1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
              fontSize: '0.8125rem',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}
            >
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Rejected By:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {approvalDecision.approver}
                </strong>
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
            <div style={{ color: 'var(--red)', fontWeight: 500 }}>
              {approvalDecision.rejectionReason || 'No explicit reason provided.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render AWAITING_APPROVAL Gate Panel
  return (
    <div
      className="c-card"
      id="approval-gate-panel"
      style={{
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--amber-bg)',
              border: '1px solid var(--amber-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--amber)',
            }}
          >
            <LockKey size={18} weight="bold" />
          </div>
          <div>
            <h3
              style={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Human Approval Gate
            </h3>
            <div
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}
            >
              Explicit engineer or DBA verification required before execution unlocks.
            </div>
          </div>
        </div>
        <span className="badge badge-amber">
          <span className="dot dot-pulse" />
          AWAITING_APPROVAL
        </span>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        {/* Rehearsal & Risk Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.875rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              Overall Risk
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '0.25rem',
                color:
                  approvalRequest?.highestRiskLevel === 'CRITICAL'
                    ? 'var(--red)'
                    : approvalRequest?.highestRiskLevel === 'HIGH'
                      ? 'var(--amber)'
                      : 'var(--green)',
              }}
            >
              {approvalRequest?.highestRiskLevel ||
                session.riskAssessment?.overallRiskLevel ||
                'LOW'}
            </div>
          </div>

          <div
            style={{
              padding: '0.875rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
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
                fontFamily: 'var(--font-mono)',
              }}
            >
              {session.target?.databaseName || 'schemasentry_test'}.
              {session.target?.schemaName || 'public'}
            </div>
          </div>

          <div
            style={{
              padding: '0.875rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
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
                    ? 'var(--green)'
                    : 'var(--amber)',
                marginTop: '0.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {session.rehearsalEvidence?.targetUntouched === true &&
              session.sandboxResult?.status === 'SUCCESS' ? (
                <>
                  <CheckCircle size={13} weight="fill" />
                  <span>Verified Untouched</span>
                </>
              ) : (
                <>
                  <WarningCircle size={13} weight="fill" />
                  <span>Unverified</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reasons / Risk Context */}
        {approvalRequest?.reasonsRequired && approvalRequest.reasonsRequired.length > 0 && (
          <div
            style={{
              padding: '0.875rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
              fontSize: '0.8125rem',
            }}
          >
            <div
              style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.375rem' }}
            >
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
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '12px',
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
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Fingerprint size={14} color="var(--accent)" />
              <span>Cryptographic Fingerprint (SHA-256)</span>
            </div>
            <div
              id="approval-fingerprint"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--accent-text)',
                background: 'var(--bg-surface)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                wordBreak: 'break-all',
                letterSpacing: '0.02em',
              }}
            >
              {approvalRequest.fingerprint}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Binds this approval deterministically to the migration AST, target catalog schema, and
              rehearsal outcome.
            </div>
          </div>
        )}

        {/* Interactive Review Form */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.125rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: '14px',
          }}
        >
          <div>
            <label
              htmlFor="approver-input"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.375rem',
                letterSpacing: '-0.01em',
              }}
            >
              Approver Identifier *
            </label>
            <input
              id="approver-input"
              type="text"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="e.g. LeadDBA / alice@company.com"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = 'var(--shadow-glow)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-subtle)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label
              htmlFor="approval-comment-input"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.375rem',
                letterSpacing: '-0.01em',
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
                padding: '0.625rem 0.875rem',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = 'var(--shadow-glow)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-subtle)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Validation error display */}
          {validationError && (
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--red)',
                fontWeight: 600,
                background: 'var(--red-bg)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--red-border)',
              }}
            >
              {validationError}
            </div>
          )}

          {/* Action Buttons - CRITICAL HIGH-CONTRAST FIX */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border-faint)',
              flexWrap: 'wrap',
            }}
          >
            {/* Reject Button */}
            <button
              id="reject-migration-btn"
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className="btn btn-outline"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderColor: 'var(--red-border)',
                color: 'var(--red)',
                background: 'var(--bg-surface)',
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'var(--red-bg)';
                  e.currentTarget.style.borderColor = 'var(--red)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--red-border)';
                }
              }}
            >
              <XCircle size={16} weight="bold" />
              <span>Reject Migration</span>
            </button>

            {/* Approve Button - High-visibility vibrant solid green with clear white text */}
            <button
              id="approve-migration-btn"
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="btn"
              style={{
                padding: '0.55rem 1.5rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                backgroundColor: 'var(--green)',
                color: '#ffffff',
                border: '1px solid var(--green)',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = '#15803d';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--green)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)';
                }
              }}
            >
              <CheckCircle size={16} weight="bold" />
              <span>{isSubmitting ? 'Recording Decision...' : 'Approve Migration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
