import React, { useEffect, useRef } from 'react';
import { Plugs, TerminalWindow, Cpu, Sparkle } from '@phosphor-icons/react';

const layers = [
  {
    num: '01',
    icon: Cpu,
    label: 'ORVEXA AGENT RUNTIME',
    description:
      'Manages migration session state machine, audit logs, and deterministic AST static risk evaluations.',
  },
  {
    num: '02',
    icon: TerminalWindow,
    label: 'DAYTONA SANDBOX RUNTIME',
    description:
      'Provisions ephemeral PostgreSQL containers, executes candidate DDL, measures lock latency, and discards state completely.',
  },
  {
    num: '03',
    icon: Sparkle,
    label: 'TRUEFORGE & GEMINI BRIEF ENGINE',
    description:
      'Connects TrueForge agent runtime with Google Gemini 3.6 Flash to generate clear, concise Executive Release Briefs for DBAs.',
  },
  {
    num: '04',
    icon: Plugs,
    label: 'MCP PROTOCOL INTERFACE',
    description:
      'Exposes standardized MCP tool schemas for read-only PostgreSQL schema inspection, statistics, and lock activity to TrueForge AI agents.',
  },
];

const mcpTools = [
  {
    fn: 'inspect_postgres_target',
    args: '(table: string, schema?: string, includeDependencies?: boolean)',
    ret: 'InspectPostgresTargetOutput',
  },
];

const integrations = [
  'PostgreSQL 16',
  'Daytona Sandboxes',
  'TrueForge Agent',
  'Google Gemini 3.6',
  'MCP Protocol',
  'Claude AI',
  'GitHub Actions',
  'pgcrypto',
  'pg_catalog',
  'PostgreSQL 16',
  'Daytona Sandboxes',
  'TrueForge Agent',
  'Google Gemini 3.6',
  'MCP Protocol',
  'Claude AI',
  'GitHub Actions',
  'pgcrypto',
  'pg_catalog',
];

export const TrueForgeIntegrationSection: React.FC = () => {
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
      id="integrations"
      className="section"
      style={{ borderTop: '1px solid var(--border-faint)', background: 'var(--bg-surface)' }}
    >
      <div className="container">
        {/* Header */}
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '4rem' }}>
          <span className="section-label">Integrations</span>
          <h2 className="section-h2">
            MCP-native.
            <br />
            Agent-ready.
          </h2>
          <p className="section-sub" style={{ marginTop: '0.75rem' }}>
            Orvexa operates as a specialized MCP service integrated with TrueForge agent
            orchestration and Daytona isolated development sandboxes.
          </p>
        </div>

        {/* Architecture layers */}
        <div
          ref={setRef(1)}
          className="reveal reveal-delay-1"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.num}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'border-color 200ms, box-shadow 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-dim)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    marginBottom: '0.875rem',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '9px',
                      background: 'var(--accent-light)',
                      border: '1px solid var(--accent-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={17} weight="bold" color="var(--accent)" />
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {layer.num}. {layer.label}
                  </span>
                </div>
                <p
                  style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}
                >
                  {layer.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* MCP Tools panel */}
        <div
          ref={setRef(2)}
          className="reveal reveal-delay-2"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-dim)',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '3rem',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid var(--border-faint)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Registered MCP Tool Surfaces
            </span>
          </div>

          <div
            style={{
              background: '#111827',
              padding: '1.25rem 1.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              lineHeight: '1.8',
            }}
          >
            {mcpTools.map((tool, i) => (
              <div key={i}>
                <span className="tok-fn">{tool.fn}</span>
                <span style={{ color: '#9ca3af' }}>{tool.args}</span>
                <span style={{ color: '#6b7280' }}> → </span>
                <span className="tok-str">{tool.ret}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Integration marquee */}
        <div ref={setRef(3)} className="reveal reveal-delay-3">
          <div
            style={{
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '1rem',
            }}
          >
            Works with
          </div>
          <div className="marquee-wrap">
            <div className="marquee-track">
              {integrations.map((item, i) => (
                <div key={i} className="marquee-item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
