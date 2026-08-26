import React from 'react';
import {
  ShieldCheck,
  LockKey,
  Database,
  CodeBlock,
  Cpu,
  ArrowsClockwise,
} from '@phosphor-icons/react';

const guarantees = [
  {
    title: 'Target Database Inspection is Read-Only',
    description:
      'Target DB operations during discovery and planning query pg_catalog and information_schema exclusively. Zero mutation occurs on target tables prior to approved execution.',
    icon: Database,
  },
  {
    title: 'Isolated Daytona Rehearsal',
    description:
      'Candidate DDL is applied against a disposable PostgreSQL container. Timing, constraint evaluation, and error codes are measured in isolation.',
    icon: Cpu,
  },
  {
    title: 'Cryptographic SHA-256 Fingerprint',
    description:
      'Human approvals are cryptographically bound to exact statement sequences and rehearsal checksums. Any alteration invalidates the approval gate.',
    icon: LockKey,
  },
  {
    title: 'Fail-Closed Transaction Classification',
    description:
      'Every statement is parsed by PostgresTransactionClassifier. Pure DDL is executed atomically inside transactions. DML is rejected upfront.',
    icon: CodeBlock,
  },
  {
    title: 'Single-Flight Execution Lock',
    description:
      'In-memory execution lock prevents concurrent executions of the same session, ensuring atomic, deterministic lifecycle progression.',
    icon: ShieldCheck,
  },
  {
    title: 'Automated Post-Flight Verification Probes',
    description:
      'Post-execution inspection validates column parity, foreign key integrity, index validity, and connection pool stability before marking completion.',
    icon: ArrowsClockwise,
  },
];

export const SafetyArchitectureSection: React.FC = () => {
  return (
    <section
      id="safety-architecture"
      className="section-spacing"
      style={{ borderTop: '1px solid var(--border-dim)' }}
    >
      <div className="app-container">
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
            Built for production database integrity
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Database migrations cannot afford guesswork. Orvexa enforces rigorous invariants at
            every layer of the execution engine.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {guarantees.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="panel"
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--accent-subtle)',
                    border: '1px solid var(--accent-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Icon size={22} weight="bold" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
