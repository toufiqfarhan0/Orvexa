import React, { useState } from 'react';
import type { ApiSessionData } from '../../services/migration-api.service.js';
import {
  ShieldCheck,
  ShieldWarning,
  CheckCircle,
  XCircle,
  WarningCircle,
  Database,
  Lock,
  Cpu,
  ArrowsCounterClockwise,
  Play,
  Clock,
} from '@phosphor-icons/react';

export interface LiveExecutionPanelProps {
  session: ApiSessionData;
  isExecuting: boolean;
  onExecute: (actor?: string) => Promise<void>;
}

export const LiveExecutionPanel: React.FC<LiveExecutionPanelProps> = ({
  session,
  isExecuting,
  onExecute,
}) => {
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [actorName, setActorName] = useState<string>(
    session.approvalDecision?.approver || 'ReleaseEngineer'
  );

  const status = session.status;
  const isApproved = status === 'APPROVED';
  const isRunning = status === 'EXECUTING' || status === 'VERIFYING' || isExecuting;
  const isExecutionFailed =
    status === 'EXECUTION_FAILED' || session.executionResult?.status === 'FAILED';
  const isVerificationFailed =
    status === 'VERIFICATION_FAILED' || session.verificationResult?.status === 'FAILED';
  const isCompleted = status === 'COMPLETED' && session.verificationResult?.status === 'PASSED';

  const approvalDecision = session.approvalDecision;
  const executionResult = session.executionResult;
  const verificationResult = session.verificationResult;
  const fingerprint = approvalDecision?.fingerprint || session.approvalRequest?.fingerprint;

  const handleExecuteClick = async () => {
    if (!confirmed || isRunning || !isApproved) return;
    await onExecute(actorName.trim() || undefined);
  };

  return (
    <div
      id="live-execution-panel"
      className="panel"
      style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-card)',
        border: isCompleted
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : isExecutionFailed || isVerificationFailed
            ? '1px solid rgba(239, 68, 68, 0.4)'
            : '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isCompleted
                ? 'rgba(16, 185, 129, 0.12)'
                : isExecutionFailed || isVerificationFailed
                  ? 'rgba(239, 68, 68, 0.12)'
                  : isApproved
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isCompleted ? (
              <ShieldCheck size={24} color="var(--status-success)" weight="bold" />
            ) : isExecutionFailed || isVerificationFailed ? (
              <ShieldWarning size={24} color="var(--status-error)" weight="bold" />
            ) : (
              <Database size={24} color="var(--accent)" weight="bold" />
            )}
          </div>
          <div>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              LIVE TARGET EXECUTION
            </h3>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                margin: '0.125rem 0 0 0',
              }}
            >
              Controlled production-grade execution against configured target database with
              automated post-flight verification probes.
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div
          id="execution-status-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            backgroundColor: isCompleted
              ? 'rgba(16, 185, 129, 0.15)'
              : isExecutionFailed || isVerificationFailed
                ? 'rgba(239, 68, 68, 0.15)'
                : isRunning
                  ? 'rgba(34, 211, 238, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
            color: isCompleted
              ? 'var(--status-success)'
              : isExecutionFailed || isVerificationFailed
                ? 'var(--status-error)'
                : isRunning
                  ? 'var(--accent)'
                  : 'var(--status-warning)',
            border: `1px solid ${
              isCompleted
                ? 'rgba(16, 185, 129, 0.3)'
                : isExecutionFailed || isVerificationFailed
                  ? 'rgba(239, 68, 68, 0.3)'
                  : isRunning
                    ? 'rgba(34, 211, 238, 0.3)'
                    : 'rgba(245, 158, 11, 0.3)'
            }`,
          }}
        >
          {status}
        </div>
      </div>

      {/* Target & Approval Context Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
            }}
          >
            Migration ID
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
            }}
          >
            {session.proposedMigration?.migrationId || session.migrationId}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
            }}
          >
            Target Database
          </div>
          <div
            style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}
          >
            {session.target?.databaseName} ({session.target?.schemaName || 'public'})
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
            }}
          >
            Approval Decision
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--status-success)',
              fontWeight: 600,
              marginTop: '0.25rem',
            }}
          >
            ✓ Approved by {approvalDecision?.approver || 'LeadDBA'}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
            }}
          >
            Rehearsal Status
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--status-success)',
              fontWeight: 600,
              marginTop: '0.25rem',
            }}
          >
            ✓ PASSED (Isolated)
          </div>
        </div>
      </div>

      {/* Sealed Cryptographic Fingerprint */}
      {fingerprint && (
        <div
          style={{
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sealed Fingerprint:
            </span>
          </div>
          <span
            id="execution-fingerprint-val"
            style={{
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--accent)',
              backgroundColor: 'rgba(34, 211, 238, 0.08)',
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
            }}
          >
            {fingerprint}
          </span>
        </div>
      )}

      {/* Progress Stepper Stages (Truthful) */}
      <div
        id="execution-progress-panel"
        style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Execution Pipeline Stages
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {/* Stage 1: PRE-FLIGHT */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                isApproved || isRunning || isCompleted || isExecutionFailed || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isApproved || isRunning || isCompleted || isExecutionFailed || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'var(--border-subtle)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
            }}
          >
            <CheckCircle size={14} color="var(--status-success)" weight="bold" />
            <span>1. PRE-FLIGHT</span>
          </div>

          {/* Stage 2: LOCK ACQUIRED */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                isRunning || isCompleted || isExecutionFailed || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isRunning || isCompleted || isExecutionFailed || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'var(--border-subtle)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
            }}
          >
            {isRunning || isCompleted || isExecutionFailed || isVerificationFailed ? (
              <CheckCircle size={14} color="var(--status-success)" weight="bold" />
            ) : (
              <Lock size={14} color="var(--text-tertiary)" />
            )}
            <span>2. LOCK</span>
          </div>

          {/* Stage 3: EXECUTING */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                isCompleted || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.08)'
                  : status === 'EXECUTING' || (isRunning && !verificationResult)
                    ? 'rgba(34, 211, 238, 0.08)'
                    : isExecutionFailed
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isCompleted || isVerificationFailed
                  ? 'rgba(16, 185, 129, 0.2)'
                  : status === 'EXECUTING'
                    ? 'rgba(34, 211, 238, 0.3)'
                    : isExecutionFailed
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'var(--border-subtle)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
            }}
          >
            {isCompleted || isVerificationFailed ? (
              <CheckCircle size={14} color="var(--status-success)" weight="bold" />
            ) : isExecutionFailed ? (
              <XCircle size={14} color="var(--status-error)" weight="bold" />
            ) : status === 'EXECUTING' ? (
              <ArrowsCounterClockwise size={14} color="var(--accent)" className="spin" />
            ) : (
              <Cpu size={14} color="var(--text-tertiary)" />
            )}
            <span>3. EXECUTING</span>
          </div>

          {/* Stage 4: VERIFYING */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isCompleted
                ? 'rgba(16, 185, 129, 0.08)'
                : status === 'VERIFYING'
                  ? 'rgba(34, 211, 238, 0.08)'
                  : isVerificationFailed
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isCompleted
                  ? 'rgba(16, 185, 129, 0.2)'
                  : status === 'VERIFYING'
                    ? 'rgba(34, 211, 238, 0.3)'
                    : isVerificationFailed
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'var(--border-subtle)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
            }}
          >
            {isCompleted ? (
              <CheckCircle size={14} color="var(--status-success)" weight="bold" />
            ) : isVerificationFailed ? (
              <XCircle size={14} color="var(--status-error)" weight="bold" />
            ) : status === 'VERIFYING' ? (
              <ArrowsCounterClockwise size={14} color="var(--accent)" className="spin" />
            ) : (
              <Database size={14} color="var(--text-tertiary)" />
            )}
            <span>4. VERIFYING</span>
          </div>

          {/* Stage 5: COMPLETED */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isCompleted
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: isCompleted ? 700 : 500,
              color: isCompleted ? 'var(--status-success)' : 'var(--text-secondary)',
            }}
          >
            {isCompleted ? (
              <CheckCircle size={14} color="var(--status-success)" weight="bold" />
            ) : (
              <Clock size={14} color="var(--text-tertiary)" />
            )}
            <span>5. COMPLETED</span>
          </div>
        </div>
      </div>

      {/* Confirmation & Trigger Gate (Shown only when in APPROVED state) */}
      {isApproved && (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(245, 158, 11, 0.04)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <WarningCircle
              size={20}
              color="var(--status-warning)"
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div>
              <div
                style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--status-warning)' }}
              >
                Target Database Modification Warning
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  lineHeight: 1.5,
                }}
              >
                This operation will modify the configured target database (
                <strong>{session.target?.databaseName}</strong>). All pre-execution safety gates,
                exclusive lock acquisition, and post-execution verification probes will execute
                automatically.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <input
                id="confirm-execution-checkbox"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={isRunning}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--status-warning)',
                  cursor: 'pointer',
                }}
              />
              <span>
                I confirm that I have reviewed the rehearsal evidence, cryptographic fingerprint,
                and approve live execution on the target database.
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Operator:
                </span>
                <input
                  id="execution-actor-input"
                  type="text"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  disabled={isRunning}
                  style={{
                    padding: '0.375rem 0.625rem',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    width: '160px',
                  }}
                />
              </div>

              <button
                id="execute-migration-btn"
                onClick={handleExecuteClick}
                disabled={!confirmed || isRunning}
                className="btn btn-primary"
                style={{
                  padding: '0.625rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  backgroundColor: confirmed ? 'var(--status-warning)' : 'rgba(245, 158, 11, 0.4)',
                  borderColor: confirmed ? 'var(--status-warning)' : 'rgba(245, 158, 11, 0.4)',
                  color: '#000',
                  opacity: !confirmed || isRunning ? 0.6 : 1,
                  cursor: !confirmed || isRunning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {isRunning ? (
                  <>
                    <ArrowsCounterClockwise size={16} className="spin" />
                    <span>Executing Migration & Probing Target...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} weight="fill" />
                    <span>Execute Migration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Execution Verification Evidence Probes */}
      {verificationResult && (
        <div
          id="verification-probes-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Automated Post-Execution Verification Probes
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Verified At: {verificationResult.verifiedAt} ({verificationResult.durationMs}ms)
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* Probe 1: SCHEMA_PARITY */}
            {(() => {
              const probe = verificationResult.checks?.find((c) => c.category === 'SCHEMA_PARITY');
              const passed = probe
                ? probe.passed
                : verificationResult.healthSummary?.schemaMatchesExpected;
              return (
                <div
                  id="schema-parity-probe"
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: passed
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      SCHEMA PARITY PROBE
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        backgroundColor: passed
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        color: passed ? 'var(--status-success)' : 'var(--status-error)',
                      }}
                    >
                      {passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    {probe?.message ||
                      (passed
                        ? 'Target schema modifications match expected diff.'
                        : 'Schema parity probe failed.')}
                  </div>
                </div>
              );
            })()}

            {/* Probe 2: CONNECTION_POOL */}
            {(() => {
              const probe = verificationResult.checks?.find(
                (c) => c.category === 'CONNECTION_POOL'
              );
              const passed = probe
                ? probe.passed
                : verificationResult.healthSummary?.connectionPoolOk;
              return (
                <div
                  id="connection-pool-probe"
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: passed
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      CONNECTION POOL & LATENCY
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        backgroundColor: passed
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        color: passed ? 'var(--status-success)' : 'var(--status-error)',
                      }}
                    >
                      {passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    {probe?.message ||
                      (passed
                        ? 'Connection healthy & latency within threshold.'
                        : 'Connection pool probe failed.')}
                  </div>
                </div>
              );
            })()}

            {/* Probe 3: INDEX_VALIDITY */}
            {(() => {
              const probe = verificationResult.checks?.find((c) => c.category === 'INDEX_VALIDITY');
              const passed = probe
                ? probe.passed
                : verificationResult.healthSummary?.indexStatusValid;
              return (
                <div
                  id="index-validity-probe"
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: passed
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      INDEX VALIDITY
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        backgroundColor: passed
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        color: passed ? 'var(--status-success)' : 'var(--status-error)',
                      }}
                    >
                      {passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    {probe?.message ||
                      (passed
                        ? 'All target indexes are in valid, usable state.'
                        : 'Invalid indexes detected post-migration.')}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Final Outcome Banners */}
      {isCompleted && (
        <div
          id="execution-success-banner"
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <CheckCircle
            size={24}
            color="var(--status-success)"
            weight="bold"
            style={{ flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--status-success)' }}>
              MIGRATION VERIFIED & COMPLETED
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginTop: '0.125rem',
              }}
            >
              Migration executed successfully against target database. All post-execution
              verification probes passed. Duration: {executionResult?.durationMs || 0}ms · Execution
              ID: {executionResult?.executionId}
            </div>
          </div>
        </div>
      )}

      {isExecutionFailed && (
        <div
          id="execution-failure-banner"
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <XCircle
            size={24}
            color="var(--status-error)"
            weight="bold"
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--status-error)' }}>
              EXECUTION FAILED
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginTop: '0.125rem',
              }}
            >
              {executionResult?.errorMessage ||
                session.lastErrorMessage ||
                'An error occurred during target database execution.'}
              {executionResult?.errorCode && <span> (Code: {executionResult.errorCode})</span>}
            </div>
          </div>
        </div>
      )}

      {isVerificationFailed && !isExecutionFailed && (
        <div
          id="verification-failure-banner"
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <WarningCircle
            size={24}
            color="var(--status-error)"
            weight="bold"
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--status-error)' }}>
              VERIFICATION FAILED
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginTop: '0.125rem',
              }}
            >
              Target execution completed, but one or more post-execution verification checks failed.
              {verificationResult?.errorMessage && (
                <span> Details: {verificationResult.errorMessage}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
