import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Lock,
  Cpu,
  ShieldCheck,
  Lightning,
  Sparkle,
  Database,
  Fingerprint,
} from '@phosphor-icons/react';

interface HeroSectionProps {
  onOpenConsole: () => void;
}

const pipeline = [
  {
    num: '01',
    title: 'Risk Analysis',
    sub: 'AST tokenization + lock evaluation',
    badge: 'PASS',
    badgeClass: 'badge-blue',
    icon: Database,
    duration: '4ms',
  },
  {
    num: '02',
    title: 'Daytona Sandbox Rehearsal',
    sub: 'Isolated PostgreSQL 16 container',
    badge: '38ms EXIT 0',
    badgeClass: 'badge-green',
    icon: Cpu,
    duration: '38ms',
  },
  {
    num: '03',
    title: 'Executive Release Brief',
    sub: 'TrueForge + Google Gemini synthesis',
    badge: 'READY',
    badgeClass: 'badge-blue',
    icon: Sparkle,
    duration: '112ms',
  },
  {
    num: '04',
    title: 'Human Approval Gate',
    sub: 'SHA-256 fingerprint: 962ef87…',
    badge: 'APPROVED',
    badgeClass: 'badge-green',
    icon: Fingerprint,
    duration: 'VERIFIED',
  },
  {
    num: '05',
    title: 'Controlled Live Execution',
    sub: 'Atomic transaction — fail-closed',
    badge: 'COMMITTED',
    badgeClass: 'badge-blue',
    icon: Lightning,
    duration: '18ms',
  },
  {
    num: '06',
    title: 'Catalog Parity Probes',
    sub: 'Post-exec snapshot diff match',
    badge: 'VERIFIED',
    badgeClass: 'badge-green',
    icon: ShieldCheck,
    duration: '100% MATCH',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenConsole }) => {
  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);
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
      { threshold: 0.15 }
    );
    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Automated progression of the active stage pulse starting from 01 Risk Analysis
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStageIdx((prev) => (prev + 1) % pipeline.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section className="hero grid-bg">
      <div className="hero-glow" />
      <div className="hero-glow-right" />

      <div className="container">
        <div className="hero-grid">
          {/* Left Column: Value Proposition & Strategic Metrics */}
          <div>
            {/* Eyebrow Chip */}
            <div ref={setRef(0)} className="hero-eyebrow reveal">
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                }}
              >
                <Cpu size={11} color="#ffffff" weight="bold" />
              </span>
              <span>Deterministic PostgreSQL Safety</span>
            </div>

            {/* H1 Headline */}
            <h1 ref={setRef(1)} className="hero-h1 reveal reveal-delay-1">
              Ship migrations
              <br />
              with <em>proof</em>.
            </h1>

            {/* Subtext */}
            <p ref={setRef(2)} className="hero-sub reveal reveal-delay-2">
              Orvexa analyzes AST locks, rehearses in isolated Daytona sandboxes, synthesizes Gemini
              briefs via TrueForge, and cryptographically verifies every PostgreSQL migration before
              production.
            </p>

            {/* Action CTAs */}
            <div ref={setRef(3)} className="hero-ctas reveal reveal-delay-3">
              <button
                onClick={onOpenConsole}
                className="btn btn-primary"
                id="hero-primary-cta"
                style={{ padding: '0.85rem 1.85rem', fontSize: '0.9375rem' }}
              >
                <span>Run Migration Probe</span>
                <span className="btn-icon">
                  <ArrowRight size={15} weight="bold" />
                </span>
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-outline"
                id="hero-secondary-cta"
                style={{ padding: '0.85rem 1.75rem', fontSize: '0.9375rem' }}
              >
                View Architecture
              </a>
            </div>

            {/* Stats Metrics Strip */}
            <div ref={setRef(4)} className="hero-stats reveal reveal-delay-4">
              {[
                { value: '100%', label: 'Read-only target\nAST lock analysis' },
                { value: '< 1s', label: 'Daytona sandbox\nspin-up per probe' },
                { value: 'SHA-256', label: 'Cryptographic\nhuman sign-off gate' },
              ].map((s) => (
                <div key={s.value} className="hero-stat">
                  <div className="hero-stat-value">{s.value}</div>
                  <div className="hero-stat-label" style={{ whiteSpace: 'pre-line' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Hano 3D Perspective Device Chassis & Pipeline Simulator */}
          <div ref={setRef(5)} className="reveal reveal-delay-2">
            <div className="pipeline-card">
              <div className="pipeline-card-inner">
                {/* Device Chassis Titlebar */}
                <div className="pipeline-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'var(--accent-light)',
                        border: '1px solid var(--accent-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Lock size={14} color="var(--accent)" weight="bold" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                        }}
                      >
                        MIG-0842 Rehearsal
                      </div>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Target: production-pg16 / schemasentry_test
                      </div>
                    </div>
                  </div>

                  <span className="badge badge-green">
                    <CheckCircle size={12} weight="fill" />
                    ALL PROBES VERIFIED
                  </span>
                </div>

                {/* 6 Rehearsal Stages with Interactive Selection */}
                <div className="pipeline-body">
                  {pipeline.map((stage, idx) => {
                    const StageIcon = stage.icon;
                    const isActive = activeStageIdx === idx;

                    return (
                      <div
                        key={stage.num}
                        onClick={() => setActiveStageIdx(idx)}
                        className="pipeline-stage"
                        style={{
                          cursor: 'pointer',
                          borderColor: isActive ? 'var(--accent)' : 'var(--border-faint)',
                          background: isActive ? 'var(--accent-light)' : '#ffffff',
                          boxShadow: isActive
                            ? '0 4px 16px rgba(37, 99, 235, 0.12), var(--shadow-inner-light)'
                            : 'none',
                          transition: 'all var(--dur-normal) var(--ease-out)',
                        }}
                      >
                        <div className="stage-left">
                          <span
                            className="stage-num"
                            style={{
                              background: isActive ? 'var(--accent)' : '#ffffff',
                              color: isActive ? '#ffffff' : 'var(--text-muted)',
                              border: isActive
                                ? '1px solid var(--accent-dark)'
                                : '1px solid var(--border-subtle)',
                              boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : undefined,
                              transition: 'all var(--dur-normal) var(--ease-out)',
                            }}
                          >
                            {stage.num}
                          </span>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              border: `1px solid ${
                                isActive ? 'var(--accent-border)' : 'var(--border-dim)'
                              }`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                              transition: 'all var(--dur-normal) var(--ease-out)',
                            }}
                          >
                            <StageIcon size={15} weight={isActive ? 'bold' : 'duotone'} />
                          </div>
                          <div className="stage-info">
                            <div
                              className="stage-name"
                              style={{
                                color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                                transition: 'color var(--dur-fast) var(--ease-out)',
                              }}
                            >
                              {stage.title}
                            </div>
                            <div className="stage-sub">{stage.sub}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {stage.duration}
                          </span>
                          <span className={`badge ${stage.badgeClass}`} style={{ flexShrink: 0 }}>
                            {stage.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chassis Footer Status Bar */}
                <div
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'var(--bg-recessed)',
                    borderTop: '1px solid var(--border-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span className="dot dot-pulse" style={{ color: 'var(--green)' }} />
                    Zero Target Mutations
                  </span>
                  <span>SHA: 962ef873b3...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
