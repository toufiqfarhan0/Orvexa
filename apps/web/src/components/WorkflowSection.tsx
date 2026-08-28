import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Flask,
  UserCheck,
  Lightning,
  Checks,
  Sparkle,
} from '@phosphor-icons/react';

const steps = [
  {
    icon: Database,
    title: 'Deterministic Risk Analysis',
    body: 'Every migration is parsed at the AST level. Lock modes, table sizes, and reversibility are scored — before any execution.',
    tabId: 'ast',
  },
  {
    icon: Flask,
    title: 'Daytona Sandbox Rehearsal',
    body: 'A full PostgreSQL 16 clone is provisioned on Daytona in milliseconds. Your migration runs against real schema fixtures in complete isolation.',
    tabId: 'sandbox',
  },
  {
    icon: Sparkle,
    title: 'Executive Release Brief',
    body: 'TrueForge and Google Gemini synthesize telemetry, locks, and schema diffs into concise risk summaries for lead DBAs.',
    tabId: 'brief',
  },
  {
    icon: UserCheck,
    title: 'Human Approval Gate',
    body: 'A SHA-256 fingerprint is generated and presented for sign-off. No execution proceeds without an exact checksum match.',
    tabId: 'approval',
  },
  {
    icon: Lightning,
    title: 'Controlled Live Execution',
    body: 'Migration executes inside an atomic transaction. On any failure, the connection is severed — zero partial states, ever.',
    tabId: 'execution',
  },
  {
    icon: Checks,
    title: 'Catalog Parity Verification',
    body: 'Post-execution, schema snapshots are diffed against the pre-approved model. Drift is surfaced immediately.',
    tabId: 'parity',
  },
];

const codeLines = [
  {
    tokens: [
      { t: '$ ', c: 'tok-cmt' },
      { t: 'orvexa probe --migration ./20240201_add_index.sql', c: '' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: '▸ ', c: 'tok-op' },
      { t: 'Parsing AST...', c: 'tok-cmt' },
    ],
  },
  {
    tokens: [
      { t: '  risk_score', c: 'tok-kw' },
      { t: ' = ', c: '' },
      { t: '"LOW"', c: 'tok-str' },
      { t: '  locks', c: 'tok-kw' },
      { t: ' = ', c: '' },
      { t: '"ACCESS SHARE"', c: 'tok-str' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: '▸ ', c: 'tok-op' },
      { t: 'Spinning up Daytona sandbox...', c: 'tok-cmt' },
    ],
  },
  {
    tokens: [
      { t: '  sandbox_id', c: 'tok-kw' },
      { t: ' = ', c: '' },
      { t: '"daytona-pg16-a4f2"', c: 'tok-str' },
    ],
  },
  {
    tokens: [
      { t: '  exit_code', c: 'tok-kw' },
      { t: '  = ', c: '' },
      { t: '0', c: 'tok-num' },
      { t: '   duration', c: 'tok-kw' },
      { t: ' = ', c: '' },
      { t: '"38ms"', c: 'tok-str' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: '▸ ', c: 'tok-op' },
      { t: 'TrueForge + Gemini brief...', c: 'tok-cmt' },
    ],
  },
  {
    tokens: [
      { t: '  verdict', c: 'tok-kw' },
      { t: '    = ', c: '' },
      { t: '"SAFE FOR PRODUCTION"', c: 'tok-str' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: '▸ ', c: 'tok-op' },
      { t: 'Generating fingerprint...', c: 'tok-cmt' },
    ],
  },
  {
    tokens: [
      { t: '  sha256', c: 'tok-kw' },
      { t: '     = ', c: '' },
      { t: '"962ef873b3c..."', c: 'tok-fn' },
    ],
  },
  {
    tokens: [
      { t: '  status', c: 'tok-kw' },
      { t: '     = ', c: '' },
      { t: '"AWAITING_APPROVAL"', c: 'tok-str' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: '✔ ', c: 'tok-fn' },
      { t: 'Probe complete — awaiting human gate', c: '' },
    ],
  },
];

export const WorkflowSection: React.FC = () => {
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
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
      { threshold: 0.12 }
    );
    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Automated progression cycling through the workflow stages (matching Hero Section pulse)
  useEffect(() => {
    const timer = setInterval(() => {
      setSelectedStepIdx((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section id="how-it-works" className="section" style={{ background: '#ffffff' }}>
      <div className="container">
        {/* Section Header */}
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '3.75rem' }}>
          <span className="section-label">How It Works</span>
          <h2 className="section-h2">
            Six-stage safety
            <br />
            before production
          </h2>
          <p className="section-sub" style={{ marginTop: '0.75rem' }}>
            Every migration passes through a deterministic pipeline. No shortcuts. No assumptions.
          </p>
        </div>

        {/* Two-Column Grid: Timeline + Live Terminal Preview */}
        <div className="workflow-grid">
          {/* Step Timeline */}
          <div className="step-list">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isSelected = selectedStepIdx === i;

              return (
                <div
                  key={step.title}
                  ref={setRef(i + 1)}
                  onClick={() => setSelectedStepIdx(i)}
                  className={`step-item reveal reveal-delay-${Math.min(i + 1, 4)}`}
                  style={{
                    cursor: 'pointer',
                    padding: '0.85rem 1.15rem',
                    borderRadius: 'var(--r-xl)',
                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--accent-border-strong)' : 'transparent'}`,
                    boxShadow: isSelected
                      ? '0 4px 20px rgba(37, 99, 235, 0.1), var(--shadow-inner-light)'
                      : undefined,
                    transition: 'all var(--dur-normal) var(--ease-out)',
                  }}
                >
                  <div className="step-num-wrap">
                    <div
                      className="step-num"
                      style={{
                        background: isSelected ? 'var(--accent)' : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--accent)',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border-subtle)',
                        boxShadow: isSelected
                          ? '0 4px 14px rgba(37, 99, 235, 0.4)'
                          : undefined,
                        transition: 'all var(--dur-normal) var(--ease-out)',
                      }}
                    >
                      <Icon size={18} weight={isSelected ? 'bold' : 'duotone'} />
                    </div>
                    {i < steps.length - 1 && <div className="step-connector" />}
                  </div>

                  <div className="step-content">
                    <div
                      className="step-title"
                      style={{
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        transition: 'color var(--dur-fast) var(--ease-out)',
                      }}
                    >
                      {step.title}
                    </div>
                    <p
                      className="step-body"
                      style={{
                        color: isSelected ? 'var(--text-secondary)' : 'var(--text-muted)',
                        transition: 'color var(--dur-fast) var(--ease-out)',
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Code Panel & Architectural Invariants */}
          <div ref={setRef(steps.length + 1)} className="wf-visual reveal reveal-delay-2">
            {/* Outer Bezel */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: '24px',
                padding: '6px',
                boxShadow: 'var(--shadow-lg), var(--shadow-inner-light)',
              }}
            >
              {/* Inner Core: High-Contrast Slate Terminal */}
              <div
                style={{
                  background: '#090d16',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {/* Terminal Chrome Titlebar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.15rem',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: '#0d131f',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                      <div
                        key={c}
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: c,
                          opacity: 0.8,
                        }}
                      />
                    ))}
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        color: '#94a3b8',
                      }}
                    >
                      orvexa probe — live telemetry
                    </span>
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.625rem',
                      color: '#22c55e',
                      background: 'rgba(34, 197, 94, 0.15)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    ● ZERO LOCK TIMEOUT
                  </span>
                </div>

                {/* Code Body */}
                <div
                  style={{
                    padding: '1.35rem 1.5rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    lineHeight: '1.8',
                    color: '#cbd5e1',
                    minHeight: '320px',
                  }}
                >
                  {codeLines.map((line, i) => (
                    <div key={i}>
                      {line.tokens.length === 0 ? (
                        <br />
                      ) : (
                        line.tokens.map((tok, j) => (
                          <span key={j} className={tok.c}>
                            {tok.t}
                          </span>
                        ))
                      )}
                    </div>
                  ))}
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '15px',
                      background: '#3b82f6',
                      verticalAlign: 'middle',
                      animation: 'blink 1.1s step-end infinite',
                    }}
                  />
                  <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
                </div>
              </div>
            </div>

            {/* Zero Partial States Invariant Callout */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1.15rem 1.35rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                boxShadow: 'var(--shadow-sm), var(--shadow-inner-light)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--green-bg)',
                  border: '1px solid var(--green-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Checks size={18} color="var(--green)" weight="bold" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Zero partial states — ever
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '0.125rem',
                  }}
                >
                  Atomic transactions with fail-closed safety logic
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
