import React, { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Lock, Cpu } from '@phosphor-icons/react';

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
  },
  {
    num: '02',
    title: 'Daytona Sandbox Rehearsal',
    sub: 'Isolated PostgreSQL 16 container',
    badge: '38ms EXIT 0',
    badgeClass: 'badge-green',
  },
  {
    num: '03',
    title: 'Executive Release Brief',
    sub: 'TrueForge + Gemini 3.6 Flash synthesis',
    badge: 'READY',
    badgeClass: 'badge-blue',
  },
  {
    num: '04',
    title: 'Human Approval Gate',
    sub: 'SHA-256 fingerprint: 962ef87…',
    badge: 'APPROVED',
    badgeClass: 'badge-green',
  },
  {
    num: '05',
    title: 'Controlled Live Execution',
    sub: 'Atomic transaction — fail-closed',
    badge: 'COMMITTED',
    badgeClass: 'badge-blue',
  },
  {
    num: '06',
    title: 'Catalog Parity Probes',
    sub: 'Post-exec snapshot diff match',
    badge: 'VERIFIED',
    badgeClass: 'badge-green',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenConsole }) => {
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

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section className="hero grid-bg">
      <div className="hero-glow" />
      <div className="hero-glow-right" />

      <div className="container">
        <div className="hero-grid">
          {/* Left column */}
          <div>
            {/* Eyebrow */}
            <div ref={setRef(0)} className="hero-eyebrow reveal" style={{ display: 'inline-flex' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent-light)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Cpu size={10} color="var(--accent)" weight="bold" />
              </span>
              Deterministic PostgreSQL Safety
            </div>

            {/* H1 */}
            <h1 ref={setRef(1)} className="hero-h1 reveal reveal-delay-1">
              Ship migrations
              <br />
              with <em>proof</em>.
            </h1>

            {/* Subtext */}
            <p ref={setRef(2)} className="hero-sub reveal reveal-delay-2">
              Orvexa analyzes AST locks, rehearses in isolated Daytona sandboxes, generates Gemini
              Executive Release Briefs via TrueForge, and cryptographically verifies every
              PostgreSQL migration before it touches production.
            </p>

            {/* CTAs */}
            <div ref={setRef(3)} className="hero-ctas reveal reveal-delay-3">
              <button
                onClick={onOpenConsole}
                className="btn btn-primary"
                id="hero-primary-cta"
                style={{ padding: '0.8rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <span>Run Migration Probe</span>
                <span className="btn-icon">
                  <ArrowRight size={13} weight="bold" />
                </span>
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-outline"
                id="hero-secondary-cta"
                style={{ padding: '0.8rem 1.75rem', fontSize: '0.9375rem' }}
              >
                View Architecture
              </a>
            </div>

            {/* Stats */}
            <div ref={setRef(4)} className="hero-stats reveal reveal-delay-4">
              {[
                { value: '100%', label: 'Read-only\ntarget analysis' },
                { value: '< 1s', label: 'Sandbox spin-up\ntime per probe' },
                { value: 'SHA-256', label: 'Cryptographic\napproval gate' },
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

          {/* Right column — pipeline card */}
          <div ref={setRef(5)} className="reveal reveal-delay-2">
            <div className="pipeline-card">
              <div className="pipeline-card-inner">
                {/* Card header */}
                <div className="pipeline-header">
                  <div className="pipeline-title">
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'var(--accent-light)',
                        border: '1px solid var(--accent-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Lock size={12} color="var(--accent)" weight="bold" />
                    </span>
                    MIG-0842
                  </div>
                  <span className="badge badge-green">
                    <CheckCircle size={10} weight="fill" />
                    ALL PROBES VERIFIED
                  </span>
                </div>

                {/* Stages */}
                <div className="pipeline-body">
                  {pipeline.map((stage) => (
                    <div key={stage.num} className="pipeline-stage">
                      <div className="stage-left">
                        <span className="stage-num">{stage.num}</span>
                        <div className="stage-info">
                          <div className="stage-name">{stage.title}</div>
                          <div className="stage-sub">{stage.sub}</div>
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
        </div>
      </div>
    </section>
  );
};
