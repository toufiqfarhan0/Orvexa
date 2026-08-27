import React from 'react';
import {
  CheckCircle,
  XCircle,
  CircleNotch,
  Database,
  Cube,
  GitDiff,
  Trash,
  Lightning,
} from '@phosphor-icons/react';
import type { MigrationSessionStatus } from '@orvexa/shared';

export interface RehearsalProgressPanelProps {
  status: MigrationSessionStatus;
  durationMs?: number;
  errorMessage?: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const REHEARSAL_STEPS: WorkflowStep[] = [
  {
    id: 'target-snapshot',
    name: '1. Target Snapshot',
    description: 'Inspect live PostgreSQL table definitions & schema metadata',
    icon: <Database size={14} />,
  },
  {
    id: 'disposable-db',
    name: '2. Disposable Database',
    description: 'Provision isolated PostgreSQL database on ephemeral runtime',
    icon: <Database size={14} />,
  },
  {
    id: 'schema-clone',
    name: '3. Schema Clone',
    description: 'Replicate exact DDL structures, constraints, and indexes',
    icon: <Database size={14} />,
  },
  {
    id: 'synthetic-fixtures',
    name: '4. Synthetic Fixtures',
    description: 'Populate representative test fixtures for realistic lock checks',
    icon: <Database size={14} />,
  },
  {
    id: 'daytona-sandbox',
    name: '5. Daytona Sandbox',
    description: 'Initialize secure Daytona workspace sandbox environment',
    icon: <Cube size={14} />,
  },
  {
    id: 'migration-exec',
    name: '6. Migration Execution',
    description: 'Execute parsed DDL statements against disposable database',
    icon: <Lightning size={14} />,
  },
  {
    id: 'post-inspection',
    name: '7. Post-Migration Inspection',
    description: 'Inspect resultant database state, columns, types & constraints',
    icon: <Database size={14} />,
  },
  {
    id: 'schema-diff',
    name: '8. Schema Diff',
    description: 'Compute precise AST diff between pre and post migration state',
    icon: <GitDiff size={14} />,
  },
  {
    id: 'cleanup',
    name: '9. Cleanup',
    description: 'Discard disposable database and terminate sandbox workspace',
    icon: <Trash size={14} />,
  },
];

export const RehearsalProgressPanel: React.FC<RehearsalProgressPanelProps> = ({
  status,
  durationMs,
  errorMessage,
}) => {
  const isRunning = status === 'SANDBOX_RUNNING';
  const isCompleted = status === 'SANDBOX_REHEARSAL_COMPLETED';
  const isFailed = status === 'SANDBOX_FAILED';

  return (
    <div className="c-card">
      {/* Panel Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <Cube size={16} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Rehearsal Workflow Execution
          </h3>
        </div>
        <span
          className={`badge ${
            isCompleted
              ? 'badge-green'
              : isRunning
                ? 'badge-amber'
                : isFailed
                  ? 'badge-red'
                  : 'badge-neutral'
          }`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className={`dot ${isRunning ? 'dot-pulse' : ''}`} />
          <span>
            {isRunning
              ? 'RUNNING'
              : isCompleted
                ? `COMPLETED${durationMs ? ` (${durationMs}ms)` : ''}`
                : isFailed
                  ? 'FAILED'
                  : 'READY'}
          </span>
        </span>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Indeterminate Running Notice */}
        {isRunning && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-border)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.8125rem',
            }}
          >
            <CircleNotch
              size={18}
              color="var(--accent)"
              style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}
            />
            <div>
              <div
                style={{ fontWeight: 700, color: 'var(--accent-text)', marginBottom: '0.125rem' }}
              >
                Executing Isolated Rehearsal Workflow
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Orchestrating disposable PostgreSQL database clone and TrueForge Daytona sandbox
                container. Target database is completely isolated.
              </div>
            </div>
          </div>
        )}

        {/* Failure Message Box */}
        {isFailed && errorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              fontSize: '0.8125rem',
            }}
          >
            <XCircle
              size={18}
              color="var(--red)"
              weight="bold"
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: '0.125rem' }}>
                Rehearsal Workflow Failed
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {errorMessage}
              </div>
            </div>
          </div>
        )}

        {/* Real Workflow Phases Grid */}
        <div className="wf-step-grid">
          {REHEARSAL_STEPS.map((step) => {
            let cardStateClass = '';
            let iconElement: React.ReactNode;

            if (isCompleted) {
              cardStateClass = 'wf-done';
              iconElement = <CheckCircle size={15} color="var(--green)" weight="fill" />;
            } else if (isRunning) {
              cardStateClass = 'wf-active';
              iconElement = (
                <CircleNotch
                  size={15}
                  color="var(--accent)"
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              );
            } else if (isFailed) {
              cardStateClass = 'wf-failed';
              iconElement = <XCircle size={15} color="var(--red)" weight="fill" />;
            } else {
              iconElement = (
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-subtle)',
                  }}
                />
              );
            }

            return (
              <div key={step.id} className={`wf-step-card ${cardStateClass}`}>
                <div
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', marginTop: '2px' }}
                >
                  {iconElement}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wf-step-title" style={{ fontFamily: 'var(--font-mono)' }}>
                    {step.name}
                  </div>
                  <div className="wf-step-desc">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
