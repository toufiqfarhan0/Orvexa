import React, { useEffect, useRef } from 'react';
import {
  ShieldCheck,
  LockKey,
  Database,
  CodeBlock,
  Cpu,
  ArrowsClockwise,
  CheckCircle,
} from '@phosphor-icons/react';

const guarantees = [
  {
    title: 'Read-Only Target Inspection',
    description:
      'Target DB operations during discovery query pg_catalog and information_schema exclusively. Zero mutation occurs prior to approved execution.',
    icon: Database,
    badge: 'ZERO-MUTATION',
    badgeClass: 'badge-blue',
    featured: true,
  },
  {
    title: 'Isolated Sandbox Rehearsal',
    description:
      'Candidate DDL is applied against a disposable PostgreSQL container. Timing, constraint evaluation, and error codes are measured in isolation.',
    icon: Cpu,
    badge: 'DAYTONA CONTAINER',
    badgeClass: 'badge-green',
    featured: true,
  },
  {
    title: 'SHA-256 Cryptographic Gate',
    description:
      'Approvals are cryptographically bound to exact statement sequences. Any alteration invalidates the approval — no silent overrides.',
    icon: LockKey,
    badge: 'CRYPTOGRAPHIC',
    badgeClass: 'badge-purple',
    featured: false,
  },
  {
    title: 'Fail-Closed Transaction Logic',
    description:
      'Every statement is parsed by PostgresTransactionClassifier. Pure DDL executes atomically. DML is rejected upfront — no surprises.',
    icon: CodeBlock,
    badge: 'ATOMIC DDL',
    badgeClass: 'badge-amber',
    featured: false,
  },
  {
    title: 'Single-Flight Execution Lock',
    description:
      'In-memory execution lock prevents concurrent runs of the same session, ensuring atomic, deterministic lifecycle progression.',
    icon: ShieldCheck,
    badge: 'CONCURRENCY GUARD',
    badgeClass: 'badge-blue',
    featured: false,
  },
  {
    title: 'Post-Flight Verification Probes',
    description:
      'Post-execution inspection validates column parity, foreign key integrity, index validity, and connection pool stability.',
    icon: ArrowsClockwise,
    badge: 'PARITY AUDIT',
    badgeClass: 'badge-green',
    featured: false,
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
      style={{
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
      }}
    >
      <div className="container">
        {/* Section Header */}
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '3.75rem' }}>
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

        {/* Balanced Grid Layout (3x2 on desktop, 2x3 on tablet, 1x6 on mobile) */}
        <div className="safety-grid">
          {guarantees.map((item, i) => {
            const Icon = item.icon;

            return (
              <div
                key={i}
                ref={setRef(i + 1)}
                className={`reveal reveal-delay-${Math.min((i % 3) + 1, 3)}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '20px',
                  padding: '1.85rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-sm), var(--shadow-inner-light)',
                  transition: 'all var(--dur-normal) var(--ease-out)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--accent-border-strong)';
                  el.style.boxShadow = 'var(--shadow-md), var(--shadow-inner-light)';
                  el.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--border-dim)';
                  el.style.boxShadow = 'var(--shadow-sm), var(--shadow-inner-light)';
                  el.style.transform = 'translateY(0)';
                }}
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
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'var(--bg-recessed)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon size={24} weight="duotone" />
                    </div>

                    <span className={`badge ${item.badgeClass}`}>{item.badge}</span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      marginBottom: '0.625rem',
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

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-faint)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <CheckCircle size={14} color="var(--green)" weight="fill" />
                  <span>Enforced deterministically</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
