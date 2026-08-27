import React, { useEffect, useRef, useState } from 'react';
import {
  Plugs,
  TerminalWindow,
  Cpu,
  Sparkle,
  Database,
  CloudCheck,
  ArrowDown,
  ShieldCheck,
} from '@phosphor-icons/react';

const architectureNodes = [
  {
    id: 'orvexa',
    title: 'ORVEXA PLATFORM',
    subtitle: 'Migration Orchestrator & Executive Brief Gate',
    icon: ShieldCheck,
    badge: 'ORCHESTRATOR',
    badgeColor: 'var(--accent)',
    description:
      'Coordinates migration sessions, performs deterministic AST lock risk evaluation, and triggers AI briefings.',
  },
  {
    id: 'trueforge-runtime',
    title: 'TrueForge Agent Runtime',
    subtitle: 'Autonomous AI Agent Harness (Port 8790)',
    icon: Cpu,
    badge: 'AGENT RUNTIME',
    badgeColor: '#8b5cf6',
    description:
      'Initializes dynamic agent specifications, mounts tool interfaces, and binds model intelligence.',
    branches: [
      { name: 'Google Gemini 3.6', detail: 'Model Reasoning', icon: Sparkle },
      { name: 'MCP Interface', detail: 'Tool Protocol', icon: Plugs },
      { name: 'DBA Instructions', detail: 'Safety System Prompt', icon: TerminalWindow },
    ],
  },
  {
    id: 'orvexa-mcp',
    title: 'Orvexa MCP Server',
    subtitle: 'Model Context Protocol Provider (/api/mcp)',
    icon: Plugs,
    badge: 'MCP PROTOCOL',
    badgeColor: '#06b6d4',
    description:
      'Exposes inspect_postgres_target over standard SSE transport for dynamic schema, table, index, and lock queries.',
  },
  {
    id: 'postgresql',
    title: 'PostgreSQL Database',
    subtitle: 'Target Database & Ephemeral Clones (Port 5432)',
    icon: Database,
    badge: 'DATA LAYER',
    badgeColor: '#3b82f6',
    description:
      'Stores schemas, tables, constraints, and metrics. Read-only inspection guarantees zero production mutations.',
  },
  {
    id: 'trueforge-sandbox',
    title: 'TrueForge Sandbox',
    subtitle: 'Isolated Agent Execution & Compute Sandbox',
    icon: TerminalWindow,
    badge: 'SANDBOX LAYER',
    badgeColor: '#f59e0b',
    description:
      'Provides hardware and network isolation for agent tool executions and migration DDL dry-runs.',
  },
  {
    id: 'daytona-cloud',
    title: 'Daytona Cloud',
    subtitle: 'Remote Sandbox Compute Provider (@daytona/sdk)',
    icon: CloudCheck,
    badge: 'CLOUD COMPUTE',
    badgeColor: '#10b981',
    description:
      'Provisions disposable container workspaces in milliseconds with automated cleanup and zero residual state.',
  },
];

const mcpTools = [
  {
    fn: 'inspect_postgres_target',
    args: '(table: string, schema?: string, includeDependencies?: boolean)',
    ret: 'InspectPostgresTargetOutput',
    description:
      'Inspects column types, check constraints, foreign keys, indexes, and lock queues.',
  },
  {
    fn: 'simulate_lock_contention',
    args: '(table: string, schema?: string, proposedLockMode?: string)',
    ret: 'LockContentionSimulationOutput',
    description:
      'Simulates PostgreSQL 8-level lock hierarchy conflicts with concurrent SELECT, INSERT, UPDATE, DELETE and autovacuum.',
  },
  {
    fn: 'generate_safe_migration_recipe',
    args: '(operation: string, table: string, schema?: string, column?: string, columnType?: string, defaultValue?: string, targetTable?: string, targetColumn?: string)',
    ret: 'SafeMigrationRecipeOutput',
    description:
      'Generates canonical zero-downtime multi-step PostgreSQL migration scripts with rollback safeguards.',
  },
];

const integrations = [
  'PostgreSQL 16',
  'Daytona Sandboxes',
  'TrueForge Agent',
  'Google Gemini 3.6 Flash',
  'Model Context Protocol',
  'Docker Containers',
  'Bubblewrap SRT',
  'pg_catalog',
  'PostgreSQL 16',
  'Daytona Sandboxes',
  'TrueForge Agent',
  'Google Gemini 3.6 Flash',
  'Model Context Protocol',
  'Docker Containers',
  'Bubblewrap SRT',
  'pg_catalog',
];

export const TrueForgeIntegrationSection: React.FC = () => {
  const [activeNode, setActiveNode] = useState<string>('trueforge-runtime');
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
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '3.5rem' }}>
          <span className="section-label">Architecture</span>
          <h2 className="section-h2">
            TrueForge Agent Runtime
            <br />
            Powered by MCP & Daytona
          </h2>
          <p className="section-sub" style={{ marginTop: '0.75rem' }}>
            Orvexa orchestrates TrueForge AI agents equipped with standardized Model Context
            Protocol (MCP) database inspection tools and Daytona Cloud isolated sandboxes.
          </p>
        </div>

        {/* Interactive Architecture Flowchart */}
        <div
          ref={setRef(1)}
          className="reveal reveal-delay-1"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-dim)',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '2.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-faint)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--green)',
                  boxShadow: '0 0 8px var(--green)',
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                End-to-End Execution Flow
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              Click nodes to view interaction details
            </span>
          </div>

          {/* Connected Flow Diagram */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {architectureNodes.map((node, index) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;

              return (
                <React.Fragment key={node.id}>
                  {index > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <ArrowDown size={18} weight="bold" />
                    </div>
                  )}

                  <div
                    onClick={() => setActiveNode(node.id)}
                    style={{
                      width: '100%',
                      maxWidth: '720px',
                      background: isSelected ? 'var(--accent-light)' : 'var(--bg-surface)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      borderRadius: '14px',
                      padding: '1.125rem 1.5rem',
                      cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSelected ? '0 0 0 2px var(--accent-border)' : 'var(--shadow-xs)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                            color: isSelected ? '#ffffff' : 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon size={18} weight="bold" />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.9375rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {node.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {node.subtitle}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: `${node.badgeColor}18`,
                          color: node.badgeColor,
                          border: `1px solid ${node.badgeColor}33`,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {node.badge}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {node.description}
                    </p>

                    {/* Sub-branches for TrueForge Agent */}
                    {node.branches && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.5rem',
                          marginTop: '0.875rem',
                          paddingTop: '0.875rem',
                          borderTop: '1px solid var(--border-faint)',
                        }}
                      >
                        {node.branches.map((branch, bIdx) => {
                          const BranchIcon = branch.icon;
                          return (
                            <div
                              key={bIdx}
                              style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-dim)',
                                borderRadius: '8px',
                                padding: '0.5rem 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <BranchIcon size={14} color="var(--accent)" weight="fill" />
                              <div>
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {branch.name}
                                </div>
                                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                  {branch.detail}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
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
              justifyContent: 'space-between',
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
              Registered MCP Tool Surfaces (SSE Transport: /api/mcp)
            </span>
            <span
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--green)',
                background: 'var(--green-bg)',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                border: '1px solid var(--green-border)',
              }}
            >
              ✓ ACTIVE
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
                <div>
                  <span className="tok-fn">{tool.fn}</span>
                  <span style={{ color: '#9ca3af' }}>{tool.args}</span>
                  <span style={{ color: '#6b7280' }}> → </span>
                  <span className="tok-str">{tool.ret}</span>
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: '#6b7280',
                    marginTop: '0.25rem',
                  }}
                >
                  // {tool.description}
                </div>
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
            Production Infrastructure Stack
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
