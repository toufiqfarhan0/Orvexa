import React from 'react';
import { Plugs, TerminalWindow, Cpu } from '@phosphor-icons/react';

export const TrueForgeIntegrationSection: React.FC = () => {
  return (
    <section
      id="trueforge-platform"
      className="section-spacing"
      style={{ borderBottom: '1px solid var(--border-dim)' }}
    >
      <div className="app-container">
        <div style={{ marginBottom: '3.5rem', maxWidth: '65ch' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
            }}
          >
            TrueForge and Daytona Integration
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            Orvexa operates as a specialized MCP service integrated with TrueForge agent
            orchestration and Daytona isolated development sandboxes.
          </p>
        </div>

        {/* Integration Architecture Card */}
        <div className="panel" style={{ padding: '2rem', backgroundColor: '#090c13' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
              position: 'relative',
            }}
          >
            {/* Layer 1: Orvexa Agent Core */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <Cpu size={18} color="var(--accent)" weight="bold" />
                <span
                  style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  01. ORVEXA AGENT RUNTIME
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Manages migration session state machine, audit logs, and approval policies with
                deterministic transitions.
              </p>
            </div>

            {/* Layer 2: TrueForge MCP Server */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <Plugs size={18} color="var(--accent)" weight="bold" />
                <span
                  style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  02. MCP PROTOCOL INTERFACE
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Exposes standardized tool schemas for inspection, rehearsal, human approval gate,
                and controlled execution.
              </p>
            </div>

            {/* Layer 3: Daytona Sandbox Engine */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <TerminalWindow size={18} color="var(--accent)" weight="bold" />
                <span
                  style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  03. DAYTONA WORKSPACE
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Provisions ephemeral PostgreSQL containers, executes candidate DDL, measures
                latency, and cleans up completely.
              </p>
            </div>
          </div>

          {/* MCP Tools Catalog Terminal */}
          <div style={{ marginTop: '2rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              REGISTERED ORVEXA MCP TOOL SURFACES
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
