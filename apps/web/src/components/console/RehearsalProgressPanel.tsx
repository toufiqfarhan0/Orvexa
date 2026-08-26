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
    icon: <Database size={15} />,
  },
  {
    id: 'disposable-db',
    name: '2. Disposable Database',
    description: 'Provision isolated PostgreSQL database on ephemeral runtime',
    icon: <Database size={15} />,
  },
  {
    id: 'schema-clone',
    name: '3. Schema Clone',
    description: 'Replicate exact DDL structures, constraints, and indexes',
    icon: <Database size={15} />,
  },
  {
    id: 'synthetic-fixtures',
    name: '4. Synthetic Fixtures',
    description: 'Populate representative test fixtures for realistic lock checks',
    icon: <Database size={15} />,
  },
  {
    id: 'daytona-sandbox',
    name: '5. Daytona Sandbox',
    description: 'Initialize secure Daytona workspace sandbox environment',
    icon: <Cube size={15} />,
  },
  {
    id: 'migration-exec',
    name: '6. Migration Execution',
    description: 'Execute parsed DDL statements against disposable database',
    icon: <Lightning size={15} />,
  },
  {
    id: 'post-inspection',
    name: '7. Post-Migration Inspection',
    description: 'Inspect resultant database state, columns, types & constraints',
    icon: <Database size={15} />,
  },
  {
    id: 'schema-diff',
    name: '8. Schema Diff',
    description: 'Compute precise AST diff between pre and post migration state',
    icon: <GitDiff size={15} />,
  },
  {
    id: 'cleanup',
    name: '9. Cleanup',
    description: 'Discard disposable database and terminate sandbox workspace',
    icon: <Trash size={15} />,
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
    <div
      className="panel-elevated"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Panel Header */}
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
          <Cube size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Rehearsal Workflow Execution</h3>
        </div>
        <span
          className={`badge ${
            isCompleted
              ? 'badge-success'
              : isRunning
                ? 'badge-warning'
                : isFailed
                  ? 'badge-error'
                  : 'badge-neutral'
          }`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className="status-indicator" />
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

      {/* Indeterminate Running Notice */}
      {isRunning && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(34, 211, 238, 0.06)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.8125rem',
          }}
        >
          <CircleNotch
            size={18}
            color="var(--accent)"
            className="spin"
            style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '0.125rem' }}>
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
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            fontSize: '0.8125rem',
          }}
        >
          <XCircle
            size={18}
            color="var(--status-error)"
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div>
            <div
              style={{ fontWeight: 600, color: 'var(--status-error)', marginBottom: '0.125rem' }}
            >
              Rehearsal Workflow Failed
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              {errorMessage}
            </div>
          </div>
        </div>
      )}

      {/* Real Workflow 9 Phases Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {REHEARSAL_STEPS.map((step) => {
          let stepStatus: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
          if (isCompleted) {
            stepStatus = 'completed';
          } else if (isRunning) {
            stepStatus = 'running';
          } else if (isFailed) {
            stepStatus = 'failed';
          }

          let iconElement: React.ReactNode;
          let borderColor = 'var(--border-dim)';
          let bgColor = 'var(--bg-canvas)';

          if (stepStatus === 'completed') {
            iconElement = <CheckCircle size={16} color="var(--status-success)" weight="fill" />;
            borderColor = 'rgba(16, 185, 129, 0.2)';
            bgColor = 'rgba(16, 185, 129, 0.03)';
          } else if (stepStatus === 'running') {
            iconElement = (
              <CircleNotch
                size={16}
                color="var(--accent)"
                style={{ animation: 'spin 1s linear infinite' }}
              />
            );
            borderColor = 'var(--accent-border)';
            bgColor = 'rgba(34, 211, 238, 0.03)';
          } else if (stepStatus === 'failed') {
            iconElement = <XCircle size={16} color="var(--status-error)" weight="fill" />;
            borderColor = 'rgba(244, 63, 94, 0.25)';
            bgColor = 'rgba(244, 63, 94, 0.03)';
          } else {
            iconElement = (
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            );
          }

          return (
            <div
              key={step.id}
              style={{
                padding: '0.625rem 0.75rem',
                backgroundColor: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {iconElement}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {step.name}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
