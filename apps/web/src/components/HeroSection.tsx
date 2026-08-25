import React from 'react';
import { ArrowRight, CheckCircle, Cpu, Sparkle } from '@phosphor-icons/react';

interface HeroSectionProps {
  onOpenConsole: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenConsole }) => {
  return (
    <section
      style={{
        paddingTop: '3.5rem',
        paddingBottom: '4.5rem',
        position: 'relative',
        borderBottom: '1px solid var(--border-dim)',
      }}
    >
      <div className="app-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left Column: Headline, Value Proposition, Action CTAs */}
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="badge badge-cyan">
                <Sparkle size={13} weight="fill" />
                <span>Deterministic PostgreSQL Safety</span>
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.5rem, 4.5vw, 3.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.035em',
                lineHeight: 1.08,
                marginBottom: '1.25rem',
                color: '#ffffff',
              }}
            >
              Ship database changes with proof.
            </h1>

            <p
              style={{
                fontSize: '1.0625rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                marginBottom: '2rem',
                maxWidth: '52ch',
              }}
            >
              Orvexa analyzes, rehearses in isolated sandboxes, requires human approval, and
              verifies PostgreSQL migrations before production.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={onOpenConsole}
                className="btn btn-primary"
                id="hero-primary-cta"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9375rem' }}
              >
                <span>Run Migration Probe</span>
                <ArrowRight size={16} weight="bold" />
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-secondary"
                id="hero-secondary-cta"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9375rem' }}
              >
                <span>View Architecture</span>
              </a>
            </div>

            {/* Verification highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginTop: '2.75rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-dim)',
              }}
            >
              <div>
                <div
                  style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  Read-Only Target
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Zero prod impact
                </div>
              </div>
              <div>
                <div
                  style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  Daytona Sandbox
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Isolated DDL rehearsal
                </div>
              </div>
              <div>
                <div
                  style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  SHA-256 Gate
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Drift-proof approval
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mission Control Pipeline Visual */}
          <div className="panel" style={{ padding: '1.25rem', backgroundColor: '#090b11' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-dim)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={16} color="var(--accent)" weight="bold" />
                <span
                  style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  SESSION ORVEXA-MIG-0842
                </span>
              </div>
              <span className="badge badge-success">
                <CheckCircle size={12} weight="fill" />
                <span>ALL PROBES VERIFIED</span>
              </span>
            </div>

            {/* Pipeline Stage Indicators */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {/* Stage 1 */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    01
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Deterministic Risk Analysis
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      AST tokenization + exclusive lock evaluation
                    </div>
                  </div>
                </div>
                <span className="badge badge-cyan">PASS (LOW)</span>
              </div>

              {/* Stage 2 */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    02
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Disposable Sandbox Rehearsal
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      PostgreSQL 16 clone + synthetic schema fixtures
                    </div>
                  </div>
                </div>
                <span className="badge badge-success">38ms EXIT 0</span>
              </div>

              {/* Stage 3 */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    03
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Human Approval & Fingerprint
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      SHA-256 checksum lock: 962ef873...
                    </div>
                  </div>
                </div>
                <span className="badge badge-success">APPROVED</span>
              </div>

              {/* Stage 4 */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    04
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Controlled Live Execution
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Atomic transaction with fail-closed safety
                    </div>
                  </div>
                </div>
                <span className="badge badge-cyan">COMMITTED</span>
              </div>

              {/* Stage 5 */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    05
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Catalog Parity Verification
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Post-execution snapshot matching diff model
                    </div>
                  </div>
                </div>
                <span className="badge badge-success">MATCHED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
