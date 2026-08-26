import React from 'react';
import { MagnifyingGlass, Flask, Keyhole, Lightning, Checks } from '@phosphor-icons/react';

const phases = [
  {
    num: '01',
    icon: MagnifyingGlass,
    title: 'Deterministic Risk Analysis',
    description:
      'The engine parses migration statements into explicit AST operations, checks for table lock escalation, and verifies compatibility against live target catalog metadata.',
    codeLines: [
      <span key="l1">
        <span className="code-keyword">ALTER TABLE</span> users{' '}
        <span className="code-keyword">ADD COLUMN</span> avatar_url{' '}
        <span className="code-keyword">VARCHAR(255)</span>;
      </span>,
      <span key="l2" style={{ color: 'var(--status-success)' }}>
        [SafetyAnalyzer] Classified: ADD_COLUMN (Lock: AccessExclusive, Risk: Low)
      </span>,
    ],
  },
  {
    num: '02',
    icon: Flask,
    title: 'Disposable Sandbox Rehearsal',
    description:
      'Orvexa launches a fresh PostgreSQL container via Daytona, applies baseline schema snapshots, executes candidate DDL, and measures timing and lock characteristics.',
    codeLines: [
      <span key="l1" className="code-comment">
        // Rehearsal telemetry in isolated environment
      </span>,
      <span key="l2">[RehearsalEngine] Database: rehearsal_reh_8449102</span>,
      <span key="l3" style={{ color: 'var(--status-success)' }}>
        [RehearsalEngine] Result: SUCCESS (Duration: 34ms)
      </span>,
    ],
  },
];

const smallPhases = [
  {
    num: '03',
    icon: Keyhole,
    title: 'Human Approval Gate',
    description:
      'The session transitions to AWAITING_APPROVAL. An engineer reviews the exact analyzed statements and commits a cryptographic SHA-256 fingerprint signature.',
    badge: 'Signature: 8b2f14ac7e...',
  },
  {
    num: '04',
    icon: Lightning,
    title: 'Controlled Live Execution',
    description:
      'Single-flight execution lock verifies target connectivity, checks schema name validity, matches the fingerprint, and executes within an atomic transaction.',
    badge: 'STATUS: COMMITTED',
    badgeSuccess: true,
  },
  {
    num: '05',
    icon: Checks,
    title: 'Post-Execution Verification',
    description:
      'Automated post-flight probes re-inspect table constraints, columns, indexes, and connection pool latency to verify catalog parity with the expected diff.',
    badge: 'PROBES: 3/3 PASSED',
    badgeSuccess: true,
  },
];

export const WorkflowSection: React.FC = () => {
  return (
    <section
      id="how-it-works"
      className="section-spacing"
      style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
    >
      <div className="app-container">
        {/* Section Header */}
        <div style={{ marginBottom: '4rem', maxWidth: '60ch' }}>
          <h2
            style={{
              fontSize: 'clamp(1.875rem, 3vw, 2.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              marginBottom: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            How Orvexa protects your database
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Every proposed schema migration passes through a five-phase verification pipeline before
            any production DDL is executed.
          </p>
        </div>

        {/* Top 2 phases */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          {phases.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.num}
                className="panel"
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--accent-subtle)',
                      border: '1px solid var(--accent-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon size={20} weight="bold" />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      background: 'var(--accent-subtle)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                    }}
                  >
                    PHASE {phase.num}
                  </span>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {phase.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {phase.description}
                  </p>
                </div>

                <div className="code-block" style={{ fontSize: '0.75rem', marginTop: 'auto' }}>
                  {phase.codeLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom 3 phases */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {smallPhases.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.num}
                className="panel"
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '11px',
                      backgroundColor: 'var(--accent-subtle)',
                      border: '1px solid var(--accent-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon size={18} weight="bold" />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      background: 'var(--accent-subtle)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                    }}
                  >
                    PHASE {phase.num}
                  </span>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: '1.0625rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {phase.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                      marginBottom: '1rem',
                    }}
                  >
                    {phase.description}
                  </p>
                </div>

                <div
                  style={{
                    padding: '0.5rem 0.875rem',
                    backgroundColor: phase.badgeSuccess
                      ? 'var(--status-success-bg)'
                      : 'var(--bg-surface-elevated)',
                    borderRadius: '8px',
                    border: `1px solid ${phase.badgeSuccess ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: phase.badgeSuccess ? 'var(--status-success)' : 'var(--text-muted)',
                    marginTop: 'auto',
                  }}
                >
                  {phase.badge}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
