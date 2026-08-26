import React from 'react';
import {
  FileCode,
  ShieldCheck,
  ShieldWarning,
  PlusCircle,
  MinusCircle,
  PencilSimple,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import type { MigrationRehearsalEvidence } from '@orvexa/shared';

export interface RehearsalEvidencePanelProps {
  evidence?: MigrationRehearsalEvidence;
}

export const RehearsalEvidencePanel: React.FC<RehearsalEvidencePanelProps> = ({ evidence }) => {
  if (!evidence) {
    return null;
  }

  const diff = evidence.schemaDifferences;
  const addedCols = diff?.columns?.added || [];
  const removedCols = diff?.columns?.removed || [];
  const modifiedCols = diff?.columns?.modified || [];

  const addedTables = diff?.tables?.added || [];
  const removedTables = diff?.tables?.removed || [];
  const modifiedTables = diff?.tables?.modified || [];

  const addedIndexes = diff?.indexes?.added || [];
  const removedIndexes = diff?.indexes?.removed || [];
  const modifiedIndexes = diff?.indexes?.modified || [];

  const addedConstraints = [
    ...(diff?.constraints?.added || []),
    ...(diff?.primaryKeys?.added || []),
    ...(diff?.foreignKeys?.added || []),
  ];
  const removedConstraints = [
    ...(diff?.constraints?.removed || []),
    ...(diff?.primaryKeys?.removed || []),
    ...(diff?.foreignKeys?.removed || []),
  ];
  const modifiedConstraints = [
    ...(diff?.constraints?.modified || []),
    ...(diff?.primaryKeys?.modified || []),
    ...(diff?.foreignKeys?.modified || []),
  ];

  const hasDiffChanges =
    diff?.hasChanges ||
    addedCols.length > 0 ||
    removedCols.length > 0 ||
    modifiedCols.length > 0 ||
    addedTables.length > 0 ||
    removedTables.length > 0 ||
    modifiedTables.length > 0 ||
    addedIndexes.length > 0 ||
    removedIndexes.length > 0 ||
    modifiedIndexes.length > 0 ||
    addedConstraints.length > 0 ||
    removedConstraints.length > 0 ||
    modifiedConstraints.length > 0;

  const isTargetVerifiedUntouched =
    evidence.targetUntouched === true && evidence.status === 'SUCCESS';

  return (
    <div
      className="panel-elevated"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
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
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileCode size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Rehearsal Execution Evidence</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            className={`badge ${evidence.status === 'SUCCESS' ? 'badge-success' : 'badge-error'}`}
            style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em' }}
          >
            {evidence.status === 'SUCCESS' ? 'REHEARSAL PASSED' : 'REHEARSAL FAILED'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            EXIT CODE: {evidence.exitCode}
          </span>
        </div>
      </div>

      {/* Failure Reason Alert if present */}
      {(evidence.failureReason || evidence.status === 'FAILED') && (
        <div
          id="rehearsal-failure-reason"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <WarningCircle
            size={20}
            color="var(--status-error)"
            weight="fill"
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--status-error)',
                letterSpacing: '0.02em',
              }}
            >
              REHEARSAL EXECUTION FAILURE
            </div>
            <div
              style={{
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.4,
              }}
            >
              {evidence.failureReason ||
                'Migration rehearsal encountered an unhandled execution error.'}
            </div>
          </div>
        </div>
      )}

      {/* Target Database Safety Indicator (Part 9) */}
      {isTargetVerifiedUntouched ? (
        <div
          id="target-untouched-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-card)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldCheck size={24} color="var(--status-success)" weight="fill" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--status-success)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                TARGET DATABASE UNCHANGED
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Rehearsal executed 100% in ephemeral PostgreSQL clone. Deep catalog comparison
                verified zero mutations on target database.
              </div>
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
            ISOLATION VERIFIED
          </span>
        </div>
      ) : (
        <div
          id="target-untouched-warning-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-card)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldWarning size={24} color="var(--status-warning)" weight="fill" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--status-warning)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                TARGET ISOLATION UNCONFIRMED
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Target database verification could not confirm deep catalog immutability. Live
                execution is prohibited.
              </div>
            </div>
          </div>
          <span className="badge badge-warning" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
            VERIFICATION INCOMPLETE
          </span>
        </div>
      )}

      {/* Rehearsal Metrics Overview Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>REHEARSAL ID</div>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
              wordBreak: 'break-all',
            }}
          >
            {evidence.rehearsalId}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            EXECUTION DURATION
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--accent)',
              marginTop: '0.25rem',
            }}
          >
            {evidence.durationMs} ms
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            STATEMENTS SUCCEEDED
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color:
                evidence.statementsFailed > 0 ? 'var(--status-error)' : 'var(--status-success)',
              marginTop: '0.25rem',
            }}
          >
            {evidence.statementsSucceeded} / {evidence.statementsAttempted}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>CLEANUP STATUS</div>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <Trash size={14} color="var(--accent)" />
            <span>{evidence.cleanupStatus || 'COMPLETED'}</span>
          </div>
        </div>
      </div>

      {/* Schema Diff Presentation (Part 8 & Finding 6) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          COMPUTED SCHEMA DIFFERENTIAL
        </div>

        {!hasDiffChanges ? (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-card)',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
            }}
          >
            Zero structural schema changes produced by migration script.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
            }}
          >
            {/* Added Columns */}
            {addedCols.map((c, i) => (
              <div
                key={`add-col-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PlusCircle size={15} color="var(--status-success)" weight="fill" />
                  <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                    ADDED COLUMN
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {c.columnName}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {c.dataType} {c.isNullable ? 'NULL' : 'NOT NULL'}
                </span>
              </div>
            ))}

            {/* Removed Columns */}
            {removedCols.map((c, i) => (
              <div
                key={`rem-col-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MinusCircle size={15} color="var(--status-error)" weight="fill" />
                  <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>
                    REMOVED COLUMN
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {c.columnName}
                  </span>
                </div>
              </div>
            ))}

            {/* Modified Columns */}
            {modifiedCols.map((m, i) => (
              <div
                key={`mod-col-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PencilSimple size={15} color="var(--status-warning)" weight="fill" />
                  <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
                    MODIFIED COLUMN
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.name}</span>
                </div>
              </div>
            ))}

            {/* Added Tables */}
            {addedTables.map((t, i) => (
              <div
                key={`add-tbl-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <PlusCircle size={15} color="var(--status-success)" weight="fill" />
                <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>ADDED TABLE</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.tableName}</span>
              </div>
            ))}

            {/* Removed Tables */}
            {removedTables.map((t, i) => (
              <div
                key={`rem-tbl-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <MinusCircle size={15} color="var(--status-error)" weight="fill" />
                <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>REMOVED TABLE</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.tableName}</span>
              </div>
            ))}

            {/* Modified Tables */}
            {modifiedTables.map((m, i) => (
              <div
                key={`mod-tbl-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <PencilSimple size={15} color="var(--status-warning)" weight="fill" />
                <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
                  MODIFIED TABLE
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.name}</span>
              </div>
            ))}

            {/* Added Indexes */}
            {addedIndexes.map((idx, i) => (
              <div
                key={`add-idx-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(34, 211, 238, 0.05)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PlusCircle size={15} color="var(--accent)" weight="fill" />
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>ADDED INDEX</span>
                  <span style={{ color: 'var(--text-primary)' }}>{idx.indexName}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  on {idx.tableName}
                </span>
              </div>
            ))}

            {/* Removed Indexes */}
            {removedIndexes.map((idx, i) => (
              <div
                key={`rem-idx-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MinusCircle size={15} color="var(--status-error)" weight="fill" />
                  <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>
                    REMOVED INDEX
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{idx.indexName}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  on {idx.tableName}
                </span>
              </div>
            ))}

            {/* Modified Indexes */}
            {modifiedIndexes.map((idx, i) => (
              <div
                key={`mod-idx-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PencilSimple size={15} color="var(--status-warning)" weight="fill" />
                  <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
                    MODIFIED INDEX
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{idx.name}</span>
                </div>
              </div>
            ))}

            {/* Added Constraints */}
            {addedConstraints.map((c, i) => (
              <div
                key={`add-cst-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(34, 211, 238, 0.05)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <PlusCircle size={15} color="var(--accent)" weight="fill" />
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>ADDED CONSTRAINT</span>
                <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
              </div>
            ))}

            {/* Removed Constraints */}
            {removedConstraints.map((c, i) => (
              <div
                key={`rem-cst-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <MinusCircle size={15} color="var(--status-error)" weight="fill" />
                <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>
                  REMOVED CONSTRAINT
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
              </div>
            ))}

            {/* Modified Constraints */}
            {modifiedConstraints.map((c, i) => (
              <div
                key={`mod-cst-${i}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <PencilSimple size={15} color="var(--status-warning)" weight="fill" />
                <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
                  MODIFIED CONSTRAINT
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rehearsal Execution Log Output */}
      {evidence.stdout && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            EXECUTION LOGS
          </div>
          <pre
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-card)',
              color: '#d1d5db',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              overflowX: 'auto',
              maxHeight: '160px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {evidence.stdout}
          </pre>
        </div>
      )}
    </div>
  );
};
