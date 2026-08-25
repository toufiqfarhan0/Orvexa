import React, { useState } from 'react';
import { Play } from '@phosphor-icons/react';

interface Scenario {
  id: string;
  name: string;
  sql: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lockType: string;
  transactionMode: 'TRANSACTION_SAFE' | 'NON_TRANSACTIONAL' | 'REJECTED';
  rehearsalResult: 'SUCCESS' | 'BLOCKED';
  approvalRequired: boolean;
  notes: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'additive-col',
    name: 'Add Column with Default (Safe Additive)',
    sql: 'ALTER TABLE events ADD COLUMN live_execution_marker INTEGER NOT NULL DEFAULT 0;',
    riskLevel: 'LOW',
    lockType: 'AccessExclusiveLock (Fast Metadata)',
    transactionMode: 'TRANSACTION_SAFE',
    rehearsalResult: 'SUCCESS',
    approvalRequired: true,
    notes: 'Safe in PostgreSQL 11+ (metadata-only update, no table rewrite).',
  },
  {
    id: 'unsafe-type',
    name: 'Alter Column Type (Destructive Mutate)',
    sql: 'ALTER TABLE orders ALTER COLUMN amount TYPE INTEGER;',
    riskLevel: 'HIGH',
    lockType: 'AccessExclusiveLock (Full Table Rewrite)',
    transactionMode: 'TRANSACTION_SAFE',
    rehearsalResult: 'BLOCKED',
    approvalRequired: true,
    notes:
      'Requires full table rewrite and validates all rows. High incident risk during peak traffic.',
  },
  {
    id: 'concurrent-index',
    name: 'Create Index Concurrently (Production Non-Blocking)',
    sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
    riskLevel: 'MEDIUM',
    lockType: 'ShareUpdateExclusiveLock',
    transactionMode: 'NON_TRANSACTIONAL',
    rehearsalResult: 'SUCCESS',
    approvalRequired: true,
    notes: 'Non-transactional in PostgreSQL. Must run outside BEGIN...COMMIT block.',
  },
];

export const InteractiveProofConsole: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 450);
  };

  return (
    <section
      id="interactive-proof"
      className="section-spacing"
      style={{ borderBottom: '1px solid var(--border-dim)' }}
    >
      <div className="app-container">
        <div style={{ marginBottom: '3rem', maxWidth: '65ch' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
            }}
          >
            Live Migration Proof Engine
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            Select a migration statement below to inspect how Orvexa parses the AST, assesses
            catalog risk, and plans safe sandbox rehearsal.
          </p>
        </div>

        {/* Console Container */}
        <div
          className="panel"
          style={{ padding: '0', overflow: 'hidden', backgroundColor: '#07090e' }}
        >
          {/* Console Header / Scenario Selector */}
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {SCENARIOS.map((scenario) => {
                const isActive = selectedScenario.id === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenario(scenario);
                    }}
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
                  >
                    {scenario.name}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="btn btn-primary"
              style={{ fontSize: '0.8125rem', padding: '0.45rem 1rem' }}
            >
              <Play size={14} weight="fill" />
              <span>{isSimulating ? 'Evaluating...' : 'Simulate Pipeline'}</span>
            </button>
          </div>

          {/* Console Body: SQL & Analysis Split */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '0',
            }}
          >
            {/* Left: Input SQL & Classification */}
            <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-dim)' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                CANDIDATE MIGRATION DDL
              </div>
              <div className="code-block" style={{ marginBottom: '1.25rem' }}>
                <span className="code-keyword">{selectedScenario.sql.split(' ')[0]}</span>{' '}
                {selectedScenario.sql.split(' ').slice(1).join(' ')}
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                DIAGNOSTIC REASONING
              </div>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {selectedScenario.notes}
              </p>
            </div>

            {/* Right: Telemetry & Invariant Checks */}
            <div style={{ padding: '1.5rem', backgroundColor: '#06080d' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                }}
              >
                DETERMINISTIC EVALUATION TELEMETRY
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Risk Level */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--border-dim)',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Risk Classification
                  </span>
                  <span
                    className={`badge ${
                      selectedScenario.riskLevel === 'LOW'
                        ? 'badge-success'
                        : selectedScenario.riskLevel === 'MEDIUM'
                          ? 'badge-warning'
                          : 'badge-error'
                    }`}
                  >
                    {selectedScenario.riskLevel} RISK
                  </span>
                </div>

                {/* Lock Invariant */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--border-dim)',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Evaluated Table Lock
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {selectedScenario.lockType}
                  </span>
                </div>

                {/* Transaction Safety */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--border-dim)',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Postgres Transaction Mode
                  </span>
                  <span className="badge badge-cyan">{selectedScenario.transactionMode}</span>
                </div>

                {/* Rehearsal Result */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--border-dim)',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Daytona Rehearsal Verdict
                  </span>
                  <span
                    className={`badge ${
                      selectedScenario.rehearsalResult === 'SUCCESS'
                        ? 'badge-success'
                        : 'badge-error'
                    }`}
                  >
                    {selectedScenario.rehearsalResult}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
