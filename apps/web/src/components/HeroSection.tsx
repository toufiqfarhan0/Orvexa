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
        paddingBottom: '5rem',
        position: 'relative',
      }}
    >
      <div className="app-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: '4rem',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left Column */}
          <div>
            {/* Pill badge */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.3rem 0.875rem 0.3rem 0.5rem',
                  borderRadius: '100px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkle size={11} weight="fill" color="var(--accent)" />
                </span>
                Deterministic PostgreSQL safety
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.75rem, 5vw, 4.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.06,
                marginBottom: '1.25rem',
                color: 'var(--text-primary)',
              }}
            >
              Ship database
              <br />
              changes with proof.
            </h1>

            <p
              style={{
                fontSize: '1.125rem',
                lineHeight: 1.65,
                color: 'var(--text-secondary)',
                marginBottom: '2.25rem',
                maxWidth: '48ch',
              }}
            >
              Orvexa analyzes, rehearses in isolated sandboxes, requires human approval, and
              verifies every PostgreSQL migration before production.
            </p>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
            >
              <button
                onClick={onOpenConsole}
                className="btn btn-primary"
                id="hero-primary-cta"
                style={{ padding: '0.8rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <span>Run Migration Probe</span>
                <ArrowRight size={16} weight="bold" />
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-secondary"
                id="hero-secondary-cta"
                style={{ padding: '0.8rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <span>View Architecture</span>
              </a>
            </div>

            {/* 3 stat highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginTop: '3rem',
                paddingTop: '2rem',
                borderTop: '1px solid var(--border-dim)',
              }}
            >
              {[
                { label: 'Read-Only Target', sub: 'Zero prod impact' },
                { label: 'Daytona Sandbox', sub: 'Isolated DDL rehearsal' },
                { label: 'SHA-256 Gate', sub: 'Drift-proof approval' },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.8125rem',
                      marginTop: '0.125rem',
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Pipeline Visual Card */}
          <div
            className="panel"
            style={{
              padding: '1.5rem',
              background: '#ffffff',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-dim)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Cpu size={14} color="#ffffff" weight="bold" />
                </div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  MIG-0842
                </span>
              </div>
              <span className="badge badge-success">
                <CheckCircle size={12} weight="fill" />
                <span>ALL PROBES VERIFIED</span>
              </span>
            </div>

            {/* Pipeline stages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                {
                  num: '01',
                  title: 'Deterministic Risk Analysis',
                  sub: 'AST tokenization + lock evaluation',
                  badge: 'PASS (LOW)',
                  badgeClass: 'badge-orange',
                },
                {
                  num: '02',
                  title: 'Disposable Sandbox Rehearsal',
                  sub: 'PostgreSQL 16 clone + schema fixtures',
                  badge: '38ms EXIT 0',
                  badgeClass: 'badge-success',
                },
                {
                  num: '03',
                  title: 'Human Approval & Fingerprint',
                  sub: 'SHA-256 checksum lock: 962ef873...',
                  badge: 'APPROVED',
                  badgeClass: 'badge-success',
                },
                {
                  num: '04',
                  title: 'Controlled Live Execution',
                  sub: 'Atomic transaction with fail-closed safety',
                  badge: 'COMMITTED',
                  badgeClass: 'badge-orange',
                },
                {
                  num: '05',
                  title: 'Catalog Parity Verification',
                  sub: 'Post-execution snapshot matching diff model',
                  badge: 'MATCHED',
                  badgeClass: 'badge-success',
                },
              ].map((stage) => (
                <div
                  key={stage.num}
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    transition: 'border-color var(--duration-fast)',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        flexShrink: 0,
                        background: 'var(--accent-subtle)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        border: '1px solid var(--accent-border)',
                      }}
                    >
                      {stage.num}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {stage.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.725rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.0625rem',
                        }}
                      >
                        {stage.sub}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${stage.badgeClass}`} style={{ flexShrink: 0 }}>
                    {stage.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
