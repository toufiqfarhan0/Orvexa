import React, { useEffect, useRef, useState } from 'react';
import {
  Plugs,
  TerminalWindow,
  Cpu,
  Sparkle,
  Database,
  CloudCheck,
  ShieldCheck,
  Copy,
  Check,
  CheckCircle,
  CaretDown,
  CaretUp,
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
    badgeColor: '#7c3aed',
    description:
      'Initializes dynamic agent specifications, mounts tool interfaces, and binds model intelligence.',
    branches: [
      { name: 'Google Gemini', detail: 'Model Reasoning', icon: Sparkle },
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
    badgeColor: '#0891b2',
    description:
      'Exposes inspect_postgres_target over standard SSE transport for dynamic schema, table, index, and lock queries.',
  },
  {
    id: 'postgresql',
    title: 'PostgreSQL Database',
    subtitle: 'Target Database & Ephemeral Clones (Port 5432)',
    icon: Database,
    badge: 'DATA LAYER',
    badgeColor: '#2563eb',
    description:
      'Stores schemas, tables, constraints, and metrics. Read-only inspection guarantees zero production mutations.',
  },
  {
    id: 'trueforge-sandbox',
    title: 'TrueForge Sandbox',
    subtitle: 'Isolated Agent Execution & Compute Sandbox',
    icon: TerminalWindow,
    badge: 'SANDBOX LAYER',
    badgeColor: '#d97706',
    description:
      'Provides hardware and network isolation for agent tool executions and migration DDL dry-runs.',
  },
  {
    id: 'daytona-cloud',
    title: 'Daytona Cloud',
    subtitle: 'Remote Sandbox Compute Provider (@daytona/sdk)',
    icon: CloudCheck,
    badge: 'CLOUD COMPUTE',
    badgeColor: '#059669',
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
  'Google Gemini',
  'Model Context Protocol',
  'Docker Containers',
  'Bubblewrap SRT',
  'pg_catalog',
  'PostgreSQL 16',
  'Daytona Sandboxes',
  'TrueForge Agent',
  'Google Gemini',
  'Model Context Protocol',
  'Docker Containers',
  'Bubblewrap SRT',
  'pg_catalog',
];

export const TrueForgeIntegrationSection: React.FC = () => {
  const [activeNode, setActiveNode] = useState<string>('trueforge-runtime');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isMcpDrawerOpen, setIsMcpDrawerOpen] = useState<boolean>(false);
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

  const handleCopyTool = (fn: string, index: number) => {
    navigator.clipboard?.writeText(fn);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const setRef = (i: number) => (el: HTMLElement | null) => {
    revealRefs.current[i] = el;
  };

  return (
    <section
      id="integrations"
      className="section"
      style={{
        borderTop: '1px solid var(--border-dim)',
        background: '#ffffff',
      }}
    >
      <div className="container">
        <div ref={setRef(0)} className="reveal" style={{ marginBottom: '2.5rem' }}>
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

        <div ref={setRef(1)} className="reveal reveal-delay-1" style={{ marginBottom: '3rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '1rem',
              textAlign: 'center',
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

        <div
          ref={setRef(2)}
          className="reveal reveal-delay-2"
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-dim)',
            borderRadius: '24px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-sm), var(--shadow-inner-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.75rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-dim)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--green)',
                  boxShadow: '0 0 10px rgba(5, 150, 105, 0.4)',
                }}
              />
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em',
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
              6 ACTIVE NODES
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            {architectureNodes.map((node) => {
              const NodeIcon = node.icon;
              const isSelected = activeNode === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => setActiveNode(node.id)}
                  style={{
                    background: isSelected ? '#ffffff' : 'var(--bg-surface)',
                    border: `1px solid ${
                      isSelected ? 'var(--accent-border-strong)' : 'var(--border-dim)'
                    }`,
                    borderRadius: '16px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-out)',
                    boxShadow: isSelected
                      ? 'var(--shadow-md), var(--shadow-inner-light)'
                      : 'var(--shadow-xs)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.875rem',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-recessed)',
                        border: `1px solid ${
                          isSelected ? 'var(--accent-border)' : 'var(--border-subtle)'
                        }`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      <NodeIcon size={18} weight={isSelected ? 'bold' : 'duotone'} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: 'var(--r-pill)',
                        background: `${node.badgeColor}15`,
                        color: node.badgeColor,
                        border: `1px solid ${node.badgeColor}30`,
                      }}
                    >
                      {node.badge}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    {node.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: '1.3',
                    }}
                  >
                    {node.subtitle}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-dim)',
              borderRadius: '16px',
              padding: '1.5rem 1.75rem',
              boxShadow: 'var(--shadow-sm), var(--shadow-inner-light)',
            }}
          >
            {architectureNodes.map((node) => {
              if (node.id !== activeNode) return null;
              const NodeIcon = node.icon;

              return (
                <div key={node.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
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
                        color: 'var(--accent)',
                      }}
                    >
                      <NodeIcon size={16} weight="bold" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {node.title} — Component Specification
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: node.badgeColor,
                        }}
                      >
                        {node.subtitle}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                      marginBottom: node.branches ? '1.25rem' : 0,
                    }}
                  >
                    {node.description}
                  </p>

                  {node.branches && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-faint)',
                      }}
                    >
                      {node.branches.map((b, bi) => {
                        const BranchIcon = b.icon;
                        return (
                          <div
                            key={bi}
                            style={{
                              background: 'var(--bg-recessed)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '10px',
                              padding: '0.75rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.625rem',
                            }}
                          >
                            <BranchIcon size={16} color="var(--accent)" />
                            <div>
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {b.name}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--text-muted)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {b.detail}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={setRef(3)}
          className="reveal reveal-delay-3"
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-dim)',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '3.5rem',
            boxShadow: 'var(--shadow-sm), var(--shadow-inner-light)',
            transition: 'all var(--dur-normal) var(--ease-out)',
          }}
        >
          <div
            onClick={() => setIsMcpDrawerOpen((prev) => !prev)}
            style={{
              padding: '1.1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              cursor: 'pointer',
              userSelect: 'none',
              borderBottom: isMcpDrawerOpen ? '1px solid var(--border-dim)' : 'none',
              transition: 'background var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-recessed)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  color: 'var(--accent)',
                }}
              >
                <Plugs size={18} weight="bold" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Registered MCP Tool Surfaces (SSE Transport: /api/mcp)
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '0.15rem',
                  }}
                >
                  {isMcpDrawerOpen
                    ? 'Click to collapse schemas'
                    : '3 live Model Context Protocol tool contracts mounted — click to inspect'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--green)',
                  background: 'var(--green-bg)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--green-border)',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <CheckCircle size={12} weight="fill" />
                <span>ACTIVE ON ENGINE</span>
              </span>

              <button
                type="button"
                style={{
                  background: 'var(--bg-recessed)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <span>{isMcpDrawerOpen ? 'Hide' : 'View Schemas (3)'}</span>
                {isMcpDrawerOpen ? (
                  <CaretUp size={12} weight="bold" />
                ) : (
                  <CaretDown size={12} weight="bold" />
                )}
              </button>
            </div>
          </div>

          {isMcpDrawerOpen && (
            <div
              style={{
                background: '#090d16',
                padding: '1.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                lineHeight: '1.8',
              }}
            >
              {mcpTools.map((tool, i) => (
                <div
                  key={i}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: i < mcpTools.length - 1 ? '1rem' : 0,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span className="tok-fn">{tool.fn}</span>
                      <span style={{ color: '#94a3b8' }}>{tool.args}</span>
                      <span style={{ color: '#64748b' }}> → </span>
                      <span className="tok-str">{tool.ret}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyTool(tool.fn, i);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                      title="Copy tool identifier"
                    >
                      {copiedIdx === i ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                      <span>{copiedIdx === i ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginTop: '0.375rem',
                    }}
                  >
                    // {tool.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
