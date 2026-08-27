import React, { useEffect, useRef } from 'react';
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
    title: 'Read-Only Target Inspection',
    description:
      'Target DB operations during discovery query pg_catalog and information_schema exclusively. Zero mutation occurs prior to approved execution.',
    icon: Database,
  },
  {
    title: 'Isolated Sandbox Rehearsal',
    description:
      'Candidate DDL is applied against a disposable PostgreSQL container. Timing, constraint evaluation, and error codes are measured in isolation.',
    icon: Cpu,
  },
  {
    title: 'SHA-256 Cryptographic Gate',
    description:
      'Approvals are cryptographically bound to exact statement sequences. Any alteration invalidates the approval — no silent overrides.',
    icon: LockKey,
  },
  {
    title: 'Fail-Closed Transaction Logic',
    description:
      'Every statement is parsed by PostgresTransactionClassifier. Pure DDL executes atomically. DML is rejected upfront — no surprises.',
    icon: CodeBlock,
  },
  {
    title: 'Single-Flight Execution Lock',
    description:
      'In-memory execution lock prevents concurrent runs of the same session, ensuring atomic, deterministic lifecycle progression.',
    icon: ShieldCheck,
  },
  {
    title: 'Post-Flight Verification Probes',
    description:
      'Post-execution inspection validates column parity, foreign key integrity, index validity, and connection pool stability.',
    icon: ArrowsClockwise,
  },
];

export const SafetyArchitectureSection: React.FC = () => {
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section
      id="safety-architecture"
      className="section"
      style={{ borderTop: '1px solid var(--border-faint)', background: 'var(--bg-base)' }}
    >
      <div className="container">
        {/* Section header */}
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '4rem' }}>
          <span className="section-label">Safety Architecture</span>
          <h2 className="section-h2">
            Built for production
            <br />
            database integrity
          </h2>
          <p className="section-sub" style={{ marginTop: '0.75rem' }}>
            Database migrations cannot afford guesswork. Orvexa enforces rigorous invariants at
            every layer of the execution engine.
          </p>
        </div>

        {/* Guarantees grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {guarantees.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                ref={setRef(i + 1)}
                className={`reveal reveal-delay-${Math.min((i % 3) + 1, 3)}`}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '20px',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  transition: 'border-color 240ms, box-shadow 240ms, transform 240ms',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--border-subtle)';
                  el.style.boxShadow = 'var(--shadow-md)';
                  el.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--border-dim)';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'var(--accent-light)',
                    border: '1px solid var(--accent-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={22} weight="bold" color="var(--accent)" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.025em',
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
