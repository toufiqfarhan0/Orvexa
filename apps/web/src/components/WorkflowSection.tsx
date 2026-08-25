import React from 'react';
import { MagnifyingGlass, Flask, Keyhole, Lightning, Checks } from '@phosphor-icons/react';

export const WorkflowSection: React.FC = () => {
  return (
    <section
      id="how-it-works"
      className="section-spacing"
      style={{ borderBottom: '1px solid var(--border-dim)' }}
    >
      <div className="app-container">
        {/* Section Header */}
        <div style={{ marginBottom: '3.5rem', maxWidth: '65ch' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
            }}
          >
            How Orvexa protects your database
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            Every proposed schema migration passes through a five-phase verification pipeline before
            any production DDL is executed.
          </p>
        </div>

        {/* 5-Phase Asymmetric Workflow Composition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Phase 1 & Phase 2: Split 2-Column Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Step 01 */}
            <div
              className="panel"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-btn)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <MagnifyingGlass size={20} weight="bold" />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      color: 'var(--accent)',
                    }}
                  >
                    PHASE 01
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Deterministic Risk Analysis
                </h3>
                <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  The engine parses migration statements into explicit AST operations, checks for
                  table lock escalation, and verifies compatibility against live target catalog
                  metadata.
                </p>
              </div>

              <div className="code-block" style={{ fontSize: '0.75rem' }}>
                <span className="code-keyword">ALTER TABLE</span> users{' '}
                <span className="code-keyword">ADD COLUMN</span> avatar_url{' '}
                <span className="code-keyword">VARCHAR(255)</span>;
                <div style={{ color: 'var(--status-success)', marginTop: '0.35rem' }}>
                  [SafetyAnalyzer] Classified: ADD_COLUMN (Lock: AccessExclusive, Risk: Low)
                </div>
              </div>
            </div>

            {/* Step 02 */}
            <div
              className="panel"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-btn)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Flask size={20} weight="bold" />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      color: 'var(--accent)',
                    }}
                  >
                    PHASE 02
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Disposable Sandbox Rehearsal
                </h3>
                <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Orvexa launches a fresh PostgreSQL container via Daytona, applies baseline schema
                  snapshots, executes candidate DDL, and measures timing and lock characteristics.
                </p>
              </div>

              <div className="code-block" style={{ fontSize: '0.75rem' }}>
                <span className="code-comment">// Rehearsal telemetry in isolated environment</span>
                <div>[RehearsalEngine] Database: rehearsal_reh_8449102</div>
                <div style={{ color: 'var(--status-success)' }}>
                  [RehearsalEngine] Result: SUCCESS (Duration: 34ms, DDL: Applied)
                </div>
              </div>
            </div>
          </div>

          {/* Phase 3, Phase 4, Phase 5: Asymmetric 3-Column Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Step 03 */}
            <div className="panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-btn)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Keyhole size={20} weight="bold" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--accent)',
                  }}
                >
                  PHASE 03
                </span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Human Approval Gate
              </h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                The session transitions to AWAITING_APPROVAL. An engineer reviews the exact analyzed
                statements and commits a cryptographic SHA-256 fingerprint signature.
              </p>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-badge)',
                  border: '1px solid var(--border-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                Signature: 8b2f14ac7e...
              </div>
            </div>

            {/* Step 04 */}
            <div className="panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-btn)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Lightning size={20} weight="bold" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--accent)',
                  }}
                >
                  PHASE 04
                </span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Controlled Live Execution
              </h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Single-flight execution lock verifies target connectivity, checks schema name
                validity, matches the fingerprint, and executes within an atomic transaction.
              </p>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-badge)',
                  border: '1px solid var(--border-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--status-success)',
                }}
              >
                STATUS: COMMITTED (BEGIN...COMMIT)
              </div>
            </div>

            {/* Step 05 */}
            <div className="panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-btn)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Checks size={20} weight="bold" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--accent)',
                  }}
                >
                  PHASE 05
                </span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Post-Execution Verification
              </h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Automated post-flight probes re-inspect table constraints, columns, indexes, and
                connection pool latency to verify catalog parity with the expected diff.
              </p>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-badge)',
                  border: '1px solid var(--border-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--status-success)',
                }}
              >
                PROBES: 3/3 PASSED (PARITY 100%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
