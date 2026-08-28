import React, { useState } from 'react';
import { Play, WarningCircle } from '@phosphor-icons/react';
import { useRouter } from '../router/Router.js';

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
    notes: 'Safe in PostgreSQL 11+ (metadata-only update, zero table rewrite).',
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

export function handoffScenarioToStorage(
  sql: string,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): { success: boolean; error?: string } {
  if (!storage) {
    return { success: false, error: 'Storage API unavailable in environment' };
  }
  try {
    storage.setItem('orvexa_pending_sql', sql);
    storage.removeItem('orvexa_active_session_id');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export const InteractiveProofConsole: React.FC = () => {
  const { navigate } = useRouter();
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setStorageNotice(null);

    if (selectedScenario?.sql) {
      const result = handoffScenarioToStorage(selectedScenario.sql);
      if (!result.success) {
        console.warn('Storage handoff notice:', result.error);
        setIsSimulating(false);
        setStorageNotice('Local storage unavailable. Opening console directly.');
      }
    }

    try {
      navigate('/console');
    } catch (navErr) {
      setIsSimulating(false);
      console.error('Navigation to migration console failed:', navErr);
    }
  };

  return (
    <section
      id="interactive-proof"
      className="section"
      style={{
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
      }}
    >
      <div className="container">
        {/* Section Header */}
        <div style={{ marginBottom: '3rem', maxWidth: '65ch' }}>
          <span className="section-label">Simulation Playground</span>
          <h2
            style={{
              fontSize: 'clamp(1.625rem, 2.75vw, 2.375rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              marginBottom: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            Live Migration Proof Engine
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.68 }}>
            Select a migration statement below to inspect how Orvexa parses the AST, assesses
            catalog risk, and plans safe sandbox rehearsal.
          </p>
        </div>

        {/* Workbench Studio Container */}
        <div
          style={{
            overflow: 'hidden',
            background: '#ffffff',
            border: '1px solid var(--border-dim)',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-md), var(--shadow-inner-light)',
          }}
        >
          {/* Console Header & Scenario Pill Selector */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: '#ffffff',
              borderBottom: '1px solid var(--border-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            {/* Segmented Pill Selector */}
            <div
              style={{
                display: 'flex',
                gap: '0.375rem',
                flexWrap: 'wrap',
                background: 'var(--bg-base)',
                padding: '0.35rem',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--border-dim)',
              }}
            >
              {SCENARIOS.map((scenario) => {
                const isActive = selectedScenario.id === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className="btn"
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.45rem 0.95rem',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderColor: isActive ? 'var(--border-subtle)' : 'transparent',
                      boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {scenario.name}
                  </button>
                );
              })}
            </div>

            {/* Launch Simulation CTA */}
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="btn btn-primary"
              id="simulate-pipeline-btn"
              style={{ fontSize: '0.8125rem', padding: '0.55rem 1.15rem' }}
              title="Open this candidate DDL in the Live Migration Console"
            >
              <Play size={14} weight="fill" />
              <span>{isSimulating ? 'Loading Console...' : 'Simulate in Console →'}</span>
            </button>
          </div>

          {/* Storage Alert Notice if applicable */}
          {storageNotice && (
            <div
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--red-bg)',
                borderBottom: '1px solid var(--red-border)',
                color: 'var(--red)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <WarningCircle size={16} weight="bold" />
              <span>{storageNotice}</span>
            </div>
          )}

          {/* Workbench Body: Split SQL & Diagnostic Telemetry */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 1fr',
              gap: '0',
            }}
          >
            {/* Left: Candidate SQL & Diagnostic Explanation */}
            <div
              style={{
                padding: '2rem',
                borderRight: '1px solid var(--border-dim)',
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '0.625rem',
                }}
              >
                CANDIDATE MIGRATION DDL
              </div>

              <div className="code-block" style={{ marginBottom: '1.5rem' }}>
                <span className="tok-kw">{selectedScenario.sql.split(' ')[0]}</span>{' '}
                {selectedScenario.sql.split(' ').slice(1).join(' ')}
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                DIAGNOSTIC REASONING & CATALOG SAFETY
              </div>
              <p
                style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.65,
                  color: 'var(--text-secondary)',
                }}
              >
                {selectedScenario.notes}
              </p>
            </div>

            {/* Right: Telemetry Chips & Invariant Evaluation */}
            <div
              style={{
                padding: '2rem',
                background: 'var(--bg-recessed)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '1rem',
                }}
              >
                DETERMINISTIC EVALUATION TELEMETRY
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Risk Level */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Risk Classification
                  </span>
                  <span
                    className={`badge ${
                      selectedScenario.riskLevel === 'LOW'
                        ? 'badge-green'
                        : selectedScenario.riskLevel === 'MEDIUM'
                          ? 'badge-amber'
                          : 'badge-red'
                    }`}
                  >
                    {selectedScenario.riskLevel} RISK
                  </span>
                </div>

                {/* Table Lock Invariant */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Evaluated Table Lock
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {selectedScenario.lockType}
                  </span>
                </div>

                {/* Transaction Mode */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Postgres Transaction Mode
                  </span>
                  <span className="badge badge-blue">{selectedScenario.transactionMode}</span>
                </div>

                {/* Daytona Rehearsal Verdict */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Daytona Rehearsal Verdict
                  </span>
                  <span
                    className={`badge ${
                      selectedScenario.rehearsalResult === 'SUCCESS' ? 'badge-green' : 'badge-red'
                    }`}
                  >
                    {selectedScenario.rehearsalResult === 'SUCCESS'
                      ? 'ISOLATED REHEARSAL PASS'
                      : 'EXECUTION BLOCKED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive breakdown for split columns */}
      <style>{`
        @media (max-width: 860px) {
          #interactive-proof [style*="grid-template-columns: 1.15fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          #interactive-proof [style*="border-right: 1px solid"] {
            border-right: none !important;
            border-bottom: 1px solid var(--border-dim) !important;
          }
        }
      `}</style>
    </section>
  );
};
