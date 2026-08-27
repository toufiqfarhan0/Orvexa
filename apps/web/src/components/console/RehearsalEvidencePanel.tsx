import React, { useState } from 'react';
import {
  FileCode,
  ShieldCheck,
  ShieldWarning,
  PlusCircle,
  MinusCircle,
  PencilSimple,
  Trash,
  WarningCircle,
  Database,
  Lightning,
  CheckCircle,
} from '@phosphor-icons/react';
import type { MigrationRehearsalEvidence } from '@orvexa/shared';
import { isMissingRelationError, isMissingColumnError } from '../../utils/error-classification.js';

export interface RehearsalEvidencePanelProps {
  evidence?: MigrationRehearsalEvidence;
}

type DiffFilter = 'all' | 'deletions' | 'additions' | 'modifications';

export const RehearsalEvidencePanel: React.FC<RehearsalEvidencePanelProps> = ({ evidence }) => {
  const [filter, setFilter] = useState<DiffFilter>('all');

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

  const totalAdditions =
    addedTables.length + addedCols.length + addedIndexes.length + addedConstraints.length;
  const totalDeletions =
    removedTables.length + removedCols.length + removedIndexes.length + removedConstraints.length;
  const totalModifications =
    modifiedTables.length +
    modifiedCols.length +
    modifiedIndexes.length +
    modifiedConstraints.length;
  const totalChanges = totalAdditions + totalDeletions + totalModifications;

  const hasDiffChanges = diff?.hasChanges || totalChanges > 0;

  // Finding 4: Reset filter to 'all' if current selected category count is 0 in the active evidence
  React.useEffect(() => {
    if (filter === 'deletions' && totalDeletions === 0) {
      setFilter('all');
    } else if (filter === 'additions' && totalAdditions === 0) {
      setFilter('all');
    } else if (filter === 'modifications' && totalModifications === 0) {
      setFilter('all');
    }
  }, [
    filter,
    totalDeletions,
    totalAdditions,
    totalModifications,
    evidence.rehearsalId,
    evidence.sessionId,
  ]);

  const isTargetVerifiedUntouched =
    evidence.targetUntouched === true && evidence.status === 'SUCCESS';

  // Helper to determine whether an item matches current filter
  const showDeletions = filter === 'all' || filter === 'deletions';
  const showAdditions = filter === 'all' || filter === 'additions';
  const showModifications = filter === 'all' || filter === 'modifications';

  return (
    <div className="c-card">
      {/* Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <FileCode size={16} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Rehearsal Execution Evidence
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            className={`badge ${evidence.status === 'SUCCESS' ? 'badge-green' : 'badge-red'}`}
            style={{ fontSize: '0.6875rem' }}
          >
            {evidence.status === 'SUCCESS' ? 'REHEARSAL PASSED' : 'REHEARSAL FAILED'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            EXIT: {evidence.exitCode}
          </span>
        </div>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Failure Reason Alert */}
        {(evidence.failureReason || evidence.status === 'FAILED') && (
          <div
            id="rehearsal-failure-reason"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              borderRadius: '12px',
            }}
          >
            <WarningCircle
              size={20}
              color="var(--red)"
              weight="fill"
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--red)' }}>
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
              {isMissingRelationError(evidence.failureReason) && (
                <div
                  style={{
                    marginTop: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  💡 <strong>Target Table Missing:</strong> The table being modified does not exist
                  on the target database yet. Use <strong>Step 1: Baseline Table</strong> to create
                  the table first before executing ALTER TABLE.
                </div>
              )}
              {isMissingColumnError(evidence.failureReason) && (
                <div
                  style={{
                    marginTop: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  💡 <strong>Target Column Missing:</strong> The column referenced in this statement
                  does not exist on the table. Verify column definitions or apply prerequisite
                  column migrations.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Target Database Safety Indicator */}
        {isTargetVerifiedUntouched ? (
          <div
            id="target-untouched-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1rem',
              background: 'var(--green-bg)',
              border: '1px solid var(--green-border)',
              borderRadius: '12px',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldCheck size={24} color="var(--green)" weight="fill" />
              <div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--green)',
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
            <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>
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
              background: 'var(--amber-bg)',
              border: '1px solid var(--amber-border)',
              borderRadius: '12px',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldWarning size={24} color="var(--amber)" weight="fill" />
              <div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--amber)',
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
            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
              VERIFICATION INCOMPLETE
            </span>
          </div>
        )}

        {/* Rehearsal Metrics Overview Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.625rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>REHEARSAL ID</div>
            <div
              style={{
                fontSize: '0.75rem',
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
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              EXECUTION DURATION
            </div>
            <div
              style={{
                fontSize: '1.125rem',
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
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              STATEMENTS SUCCEEDED
            </div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: evidence.statementsFailed > 0 ? 'var(--red)' : 'var(--green)',
                marginTop: '0.25rem',
              }}
            >
              {evidence.statementsSucceeded} / {evidence.statementsAttempted}
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>CLEANUP STATUS</div>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Trash size={14} color="var(--accent)" />
              <span>{evidence.cleanupStatus || 'COMPLETED'}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            REVAMPED SCHEMA DIFF INSPECTOR
           ═══════════════════════════════════════════════════ */}
        <div className="diff-inspector">
          {/* Diff Toolbar with Counts and Filter Tabs */}
          <div className="diff-toolbar">
            <div className="diff-stats-row">
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Database size={15} color="var(--accent)" />
                <span>Computed Schema Differential</span>
              </span>

              {totalDeletions > 0 && (
                <span className="badge badge-red" style={{ fontSize: '0.625rem' }}>
                  ⚠️ {totalDeletions} Destructive Drops
                </span>
              )}
              {totalAdditions > 0 && (
                <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>
                  +{totalAdditions} Added
                </span>
              )}
              {totalModifications > 0 && (
                <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
                  ~{totalModifications} Modified
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            {hasDiffChanges && (
              <div className="diff-filter-tabs">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`diff-tab-btn ${filter === 'all' ? 'active' : ''}`}
                >
                  All ({totalChanges})
                </button>
                {totalDeletions > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('deletions')}
                    className={`diff-tab-btn ${filter === 'deletions' ? 'active' : ''}`}
                    style={{ color: filter === 'deletions' ? 'var(--red)' : undefined }}
                  >
                    Drops ({totalDeletions})
                  </button>
                )}
                {totalAdditions > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('additions')}
                    className={`diff-tab-btn ${filter === 'additions' ? 'active' : ''}`}
                    style={{ color: filter === 'additions' ? 'var(--green)' : undefined }}
                  >
                    Additions ({totalAdditions})
                  </button>
                )}
                {totalModifications > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('modifications')}
                    className={`diff-tab-btn ${filter === 'modifications' ? 'active' : ''}`}
                    style={{ color: filter === 'modifications' ? 'var(--amber)' : undefined }}
                  >
                    Modified ({totalModifications})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Diff Content Area */}
          <div className="diff-content">
            {!hasDiffChanges ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.25rem',
                  background: 'var(--green-bg)',
                  border: '1px solid var(--green-border)',
                  borderRadius: '10px',
                  color: 'var(--green)',
                  fontSize: '0.8125rem',
                }}
              >
                <CheckCircle size={20} weight="fill" />
                <div>
                  <div style={{ fontWeight: 700 }}>Zero Structural Schema Differences</div>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      marginTop: '0.125rem',
                    }}
                  >
                    The executed SQL did not mutate existing catalog structures, columns, or
                    constraints.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 1. TABLE-LEVEL MUTATIONS (Cards with grouped columns) */}
                {(addedTables.length > 0 ||
                  removedTables.length > 0 ||
                  modifiedTables.length > 0) && (
                  <div className="diff-group">
                    <div className="diff-group-header">
                      <span>
                        Table Relations (
                        {addedTables.length + removedTables.length + modifiedTables.length})
                      </span>
                    </div>

                    {/* Removed Tables */}
                    {showDeletions &&
                      removedTables.map((t, idx) => (
                        <div key={`rem-tbl-${idx}`} className="diff-table-card del">
                          <div className="diff-table-header">
                            <div className="diff-table-title">
                              <MinusCircle size={16} color="var(--red)" weight="fill" />
                              <span style={{ color: 'var(--red)' }}>DROP TABLE</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                                {t.tableName}
                              </span>
                            </div>
                            <span className="badge badge-red" style={{ fontSize: '0.625rem' }}>
                              DESTRUCTIVE DROP
                            </span>
                          </div>
                          <div className="diff-table-body">
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              ⚠️ Dropping table <code>{t.tableName}</code> deletes the relation and
                              its underlying data permanently.
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Added Tables */}
                    {showAdditions &&
                      addedTables.map((t, idx) => (
                        <div key={`add-tbl-${idx}`} className="diff-table-card add">
                          <div className="diff-table-header">
                            <div className="diff-table-title">
                              <PlusCircle size={16} color="var(--green)" weight="fill" />
                              <span style={{ color: 'var(--green)' }}>CREATE TABLE</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                                {t.tableName}
                              </span>
                            </div>
                            <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>
                              NEW RELATION
                            </span>
                          </div>
                          <div className="diff-table-body">
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Provisioned new table <code>{t.tableName}</code> on target database
                              schema.
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Modified Tables */}
                    {showModifications &&
                      modifiedTables.map((m, idx) => (
                        <div key={`mod-tbl-${idx}`} className="diff-table-card mod">
                          <div className="diff-table-header">
                            <div className="diff-table-title">
                              <PencilSimple size={16} color="var(--amber)" weight="fill" />
                              <span style={{ color: 'var(--amber)' }}>ALTER TABLE</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                                {m.name}
                              </span>
                            </div>
                            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
                              MODIFIED
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* 2. STANDALONE COLUMN ALTERATIONS */}
                {(addedCols.length > 0 || removedCols.length > 0 || modifiedCols.length > 0) && (
                  <div className="diff-group">
                    <div className="diff-group-header">
                      <span>
                        Column Alterations (
                        {addedCols.length + removedCols.length + modifiedCols.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {/* Added Columns */}
                      {showAdditions &&
                        addedCols.map((c, i) => (
                          <div key={`add-col-${i}`} className="diff-row add">
                            <div className="diff-row-left">
                              <PlusCircle size={14} color="var(--green)" weight="bold" />
                              <span className="diff-row-name">+ {c.columnName}</span>
                              <span className="diff-row-type">{c.dataType}</span>
                            </div>
                            <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>
                              {c.isNullable ? 'NULL' : 'NOT NULL'}
                            </span>
                          </div>
                        ))}

                      {/* Removed Columns */}
                      {showDeletions &&
                        removedCols.map((c, i) => (
                          <div key={`rem-col-${i}`} className="diff-row del">
                            <div className="diff-row-left">
                              <MinusCircle size={14} color="var(--red)" weight="bold" />
                              <span className="diff-row-name">- {c.columnName}</span>
                              <span className="diff-row-type">{c.dataType}</span>
                            </div>
                            <span className="badge badge-red" style={{ fontSize: '0.625rem' }}>
                              DROPPED
                            </span>
                          </div>
                        ))}

                      {/* Modified Columns */}
                      {showModifications &&
                        modifiedCols.map((m, i) => (
                          <div key={`mod-col-${i}`} className="diff-row mod">
                            <div className="diff-row-left">
                              <PencilSimple size={14} color="var(--amber)" weight="bold" />
                              <span className="diff-row-name">~ {m.name}</span>
                            </div>
                            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
                              TYPE ALTERATION
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 3. INDEXES & CONSTRAINTS */}
                {(addedIndexes.length > 0 ||
                  removedIndexes.length > 0 ||
                  modifiedIndexes.length > 0 ||
                  addedConstraints.length > 0 ||
                  removedConstraints.length > 0 ||
                  modifiedConstraints.length > 0) && (
                  <div className="diff-group">
                    <div className="diff-group-header">
                      <span>
                        Indexes & Constraints (
                        {addedIndexes.length +
                          removedIndexes.length +
                          modifiedIndexes.length +
                          addedConstraints.length +
                          removedConstraints.length +
                          modifiedConstraints.length}
                        )
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {/* Added Constraints */}
                      {showAdditions &&
                        addedConstraints.map((c, i) => (
                          <div
                            key={`add-cst-${i}`}
                            className="diff-row"
                            style={{
                              background: 'var(--accent-light)',
                              border: '1px solid var(--accent-border)',
                            }}
                          >
                            <div className="diff-row-left">
                              <PlusCircle size={14} color="var(--accent)" weight="bold" />
                              <span
                                className="diff-row-name"
                                style={{ color: 'var(--accent-text)' }}
                              >
                                + CONSTRAINT {c.name}
                              </span>
                            </div>
                            <span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>
                              ACTIVE
                            </span>
                          </div>
                        ))}

                      {/* Modified Constraints */}
                      {showModifications &&
                        modifiedConstraints.map((c, i) => (
                          <div key={`mod-cst-${i}`} className="diff-row mod">
                            <div className="diff-row-left">
                              <PencilSimple size={14} color="var(--amber)" weight="bold" />
                              <span className="diff-row-name">~ CONSTRAINT {c.name}</span>
                            </div>
                            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
                              MODIFIED
                            </span>
                          </div>
                        ))}

                      {/* Removed Constraints */}
                      {showDeletions &&
                        removedConstraints.map((c, i) => (
                          <div key={`rem-cst-${i}`} className="diff-row del">
                            <div className="diff-row-left">
                              <MinusCircle size={14} color="var(--red)" weight="bold" />
                              <span className="diff-row-name">- CONSTRAINT {c.name}</span>
                            </div>
                            <span className="badge badge-red" style={{ fontSize: '0.625rem' }}>
                              DROPPED
                            </span>
                          </div>
                        ))}

                      {/* Added Indexes */}
                      {showAdditions &&
                        addedIndexes.map((idx, i) => (
                          <div
                            key={`add-idx-${i}`}
                            className="diff-row"
                            style={{
                              background: 'var(--accent-light)',
                              border: '1px solid var(--accent-border)',
                            }}
                          >
                            <div className="diff-row-left">
                              <Lightning size={14} color="var(--accent)" weight="bold" />
                              <span
                                className="diff-row-name"
                                style={{ color: 'var(--accent-text)' }}
                              >
                                + INDEX {idx.indexName}
                              </span>
                              <span className="diff-row-type">on {idx.tableName}</span>
                            </div>
                            <span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>
                              INDEXED
                            </span>
                          </div>
                        ))}

                      {/* Modified Indexes */}
                      {showModifications &&
                        modifiedIndexes.map((idx, i) => (
                          <div key={`mod-idx-${i}`} className="diff-row mod">
                            <div className="diff-row-left">
                              <PencilSimple size={14} color="var(--amber)" weight="bold" />
                              <span className="diff-row-name">~ INDEX {idx.name}</span>
                              {idx.after?.tableName && (
                                <span className="diff-row-type">on {idx.after.tableName}</span>
                              )}
                            </div>
                            <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>
                              MODIFIED
                            </span>
                          </div>
                        ))}

                      {/* Removed Indexes */}
                      {showDeletions &&
                        removedIndexes.map((idx, i) => (
                          <div key={`rem-idx-${i}`} className="diff-row del">
                            <div className="diff-row-left">
                              <MinusCircle size={14} color="var(--red)" weight="bold" />
                              <span className="diff-row-name">- INDEX {idx.indexName}</span>
                              <span className="diff-row-type">on {idx.tableName}</span>
                            </div>
                            <span className="badge badge-red" style={{ fontSize: '0.625rem' }}>
                              REMOVED
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Execution Log Output */}
        {evidence.stdout && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div
              style={{
                fontSize: '0.625rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Rehearsal Execution Logs
            </div>
            <pre
              style={{
                padding: '0.875rem 1rem',
                background: '#0e1726',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                color: '#e2e8f0',
                fontSize: '0.75rem',
                lineHeight: 1.5,
                overflowX: 'auto',
                maxHeight: '160px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {evidence.stdout}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
