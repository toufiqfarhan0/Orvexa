import React from 'react';
import { Plugs, TerminalWindow, Cpu } from '@phosphor-icons/react';

const layers = [
  {
    num: '01',
    icon: Cpu,
    label: 'ORVEXA AGENT RUNTIME',
    description:
      'Manages migration session state machine, audit logs, and approval policies with deterministic transitions.',
  },
  {
    num: '02',
    icon: Plugs,
    label: 'MCP PROTOCOL INTERFACE',
    description:
      'Exposes standardized tool schemas for inspection, rehearsal, human approval gate, and controlled execution.',
  },
  {
    num: '03',
    icon: TerminalWindow,
    label: 'DAYTONA WORKSPACE',
    description:
      'Provisions ephemeral PostgreSQL containers, executes candidate DDL, measures latency, and cleans up completely.',
  },
];

export const TrueForgeIntegrationSection: React.FC = () => {
  return (
    <section
      id="trueforge-platform"
      className="section-spacing"
      style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
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
            TrueForge and Daytona Integration
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Orvexa operates as a specialized MCP service integrated with TrueForge agent
            orchestration and Daytona isolated development sandboxes.
          </p>
        </div>

        {/* Architecture panel */}
        <div
          style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '2rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {layers.map((layer) => {
              const Icon = layer.icon;
              return (
                <div
                  key={layer.num}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
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
                        background: 'var(--accent-subtle)',
                        border: '1px solid var(--accent-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon size={17} weight="bold" />
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {layer.num}. {layer.label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {layer.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* MCP Tools Terminal */}
          <div style={{ marginTop: '1.75rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginBottom: '0.625rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Registered Orvexa MCP Tool Surfaces
            </div>
            <div className="code-block" style={{ fontSize: '0.8125rem' }}>
              <div>
                <span className="code-function">inspect_database</span> (schemaName, tableNames) :
                DatabaseCatalogSnapshot
              </div>
              <div>
                <span className="code-function">analyze_migration</span> (sessionId, statements) :
                MigrationRiskAnalysis
              </div>
              <div>
                <span className="code-function">rehearse_migration</span> (sessionId, statements) :
                SandboxRehearsalResult
              </div>
              <div>
                <span className="code-function">request_approval</span> (sessionId, actor) :
                ApprovalRequestToken
              </div>
              <div>
                <span className="code-function">record_approval</span> (sessionId, decision,
                approver) : SignedApprovalDecision
              </div>
              <div>
                <span className="code-function">execute_live_migration</span> (sessionId, actor) :
                LiveExecutionResult
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
