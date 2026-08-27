import React, { useEffect, useRef } from 'react';
import { Database, Flask, UserCheck, Lightning, Checks, Sparkle } from '@phosphor-icons/react';

const steps = [
  {
    icon: Database,
    title: 'Deterministic Risk Analysis',
    body: 'Every migration is parsed at the AST level. Lock modes, table sizes, and reversibility are scored — before any execution.',
  },
  {
    icon: Flask,
    title: 'Daytona Sandbox Rehearsal',
    body: 'A full PostgreSQL 16 clone is provisioned on Daytona in milliseconds. Your migration runs against real schema fixtures in complete isolation.',
  },
  {
    icon: Sparkle,
    title: 'Executive Release Brief',
    body: 'TrueForge and Google Gemini 3.6 Flash synthesize telemetry, locks, and schema diffs into concise risk summaries for lead DBAs.',
  },
  {
    icon: UserCheck,
    title: 'Human Approval Gate',
    body: 'A SHA-256 fingerprint is generated and presented for sign-off. No execution proceeds without an exact checksum match.',
  },
  {
    icon: Lightning,
    title: 'Controlled Live Execution',
    body: 'Migration executes inside an atomic transaction. On any failure, the connection is severed — zero partial states, ever.',
  },
  {
    icon: Checks,
    title: 'Catalog Parity Verification',
    body: 'Post-execution, schema snapshots are diffed against the pre-approved model. Drift is surfaced immediately.',
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
      { t: 'TrueForge + Gemini 3.6 Flash brief...', c: 'tok-cmt' },
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

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section id="how-it-works" className="section">
      <div className="container">
        {/* Section header */}
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '4rem' }}>
          <span className="section-label">How It Works</span>
          <h2 className="section-h2">
            Five-stage safety
            <br />
            before production
          </h2>
          <p className="section-sub" style={{ marginTop: '0.75rem' }}>
            Every migration passes through a deterministic pipeline. No shortcuts. No assumptions.
          </p>
        </div>

        {/* Two-col layout */}
        <div className="workflow-grid">
          {/* Steps */}
          <div className="step-list">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  ref={setRef(i + 1)}
                  className={`step-item reveal reveal-delay-${Math.min(i + 1, 4)}`}
                >
                  <div className="step-num-wrap">
                    <div className="step-num">
                      <Icon size={16} weight="duotone" color="var(--text-secondary)" />
                    </div>
                    {i < steps.length - 1 && <div className="step-connector" />}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{step.title}</div>
                    <p className="step-body">{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Code panel — intentionally dark terminal on light page */}
          <div ref={setRef(steps.length + 1)} className="wf-visual reveal reveal-delay-2">
            {/* Outer bezel */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '24px',
                padding: '4px',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {/* Inner core — dark terminal */}
              <div
                style={{
                  background: '#111827',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Terminal chrome */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: '#0d1520',
                  }}
                >
                  {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                    <div
                      key={c}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: c,
                        opacity: 0.75,
                      }}
                    />
                  ))}
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      color: '#6b7280',
                    }}
                  >
                    orvexa — probe
                  </span>
                </div>

                {/* Code */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    lineHeight: '1.8',
                    color: '#c8d6f4',
                    minHeight: '300px',
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

            {/* Callout card */}
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem 1.25rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent-border)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 0 0 1px var(--accent-border), var(--shadow-blue)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--accent-light)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Checks size={16} color="var(--accent)" weight="bold" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.8125rem',
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
                  Atomic transactions with fail-closed safety
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
