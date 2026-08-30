import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar.js';
import { Footer } from '../components/Footer.js';
import { useRouter } from '../router/Router.js';

/* ─────────────────────────────────────────────────────────────
   Inline styles that extend — but don't override — index.css
───────────────────────────────────────────────────────────── */

const paperStyles: Record<string, React.CSSProperties> = {
  hero: {
    background: 'linear-gradient(160deg, #f0f4ff 0%, #fafbfc 55%, #f8fafc 100%)',
    borderBottom: '1px solid var(--border-faint)',
    paddingTop: 'calc(var(--nav-h) + 4rem)',
    paddingBottom: '4rem',
  },
  heroInner: {
    maxWidth: '820px',
    margin: '0 auto',
    padding: '0 2rem',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'var(--accent-light)',
    border: '1px solid var(--accent-border)',
    color: 'var(--accent-text)',
    borderRadius: '999px',
    padding: '0.35rem 0.9rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: '1.75rem',
  },
  title: {
    fontSize: 'clamp(1.9rem, 4vw, 3rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.08,
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    marginBottom: '2rem',
    letterSpacing: '0.02em',
  },
  authorsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    flexWrap: 'wrap',
    marginBottom: '2rem',
  },
  authorCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    padding: '0.75rem 1.25rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    boxShadow: 'var(--shadow-sm)',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  metaDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'var(--border-medium)',
    display: 'inline-block',
  },

  /* Sidebar TOC */
  layout: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '4rem 2rem 6rem',
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    gap: '4rem',
    alignItems: 'start',
  },
  toc: {
    position: 'sticky',
    top: 'calc(var(--nav-h) + 1.5rem)',
  },
  tocTitle: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-subtle)',
    marginBottom: '0.75rem',
    fontFamily: 'var(--font-mono)',
  },
  tocList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },

  /* Paper body */
  paper: {
    minWidth: 0,
  },
  section: {
    marginBottom: '3.5rem',
    scrollMarginTop: 'calc(var(--nav-h) + 2rem)',
  },
  sectionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    marginBottom: '0.625rem',
  },
  sectionTitle: {
    fontSize: '1.45rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
    marginBottom: '1.125rem',
  },
  body: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    marginBottom: '1rem',
  },
  abstract: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-dim)',
    borderLeft: '3px solid var(--accent)',
    borderRadius: 'var(--r-md)',
    padding: '1.5rem 1.75rem',
    marginBottom: '3.5rem',
  },
  abstractLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    marginBottom: '0.75rem',
  },

  /* Cards / callouts */
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-xl)',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  cardBody: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
  },

  /* Phase pipeline */
  pipeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '0.75rem',
    marginTop: '1.25rem',
    marginBottom: '1.25rem',
  },
  phaseCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    padding: '1rem 1.125rem',
    boxShadow: 'var(--shadow-xs)',
    position: 'relative',
    overflow: 'hidden',
  },
  phaseNumber: {
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    marginBottom: '0.375rem',
  },
  phaseName: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '0.375rem',
  },
  phaseDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },

  /* Code block */
  codeBlock: {
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: 'var(--r-lg)',
    padding: '1.25rem 1.5rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    lineHeight: 1.7,
    overflowX: 'auto',
    marginBottom: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  codeKeyword: { color: '#7dd3fc' },
  codeComment: { color: '#64748b' },
  codeString: { color: '#86efac' },

  /* Table */
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border-subtle)',
    marginBottom: '1.25rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    background: 'var(--bg-subtle)',
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '0.75rem 1rem',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-faint)',
    verticalAlign: 'top',
  },

  /* Divider */
  divider: {
    border: 'none',
    borderTop: '1px solid var(--border-faint)',
    margin: '2rem 0',
  },

  /* References */
  refItem: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.65,
    paddingLeft: '1.5rem',
    position: 'relative',
    marginBottom: '0.625rem',
  },
  refIndex: {
    position: 'absolute',
    left: 0,
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '0.75rem',
  },
};

/* ─────────────────────── Table of Contents ─────────────────── */

const TOC_ITEMS = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'introduction', label: '1. Introduction' },
  { id: 'problem', label: '2. Problem Statement' },
  { id: 'system-design', label: '3. System Design' },
  { id: 'architecture', label: '4. Architecture' },
  { id: 'safety-model', label: '5. Safety Model' },
  { id: 'evaluation', label: '6. Evaluation' },
  { id: 'related-work', label: '7. Related Work' },
  { id: 'conclusion', label: '8. Conclusion' },
  { id: 'references', label: 'References' },
];

function TableOfContents({ activeId }: { activeId: string }) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside style={paperStyles.toc}>
      <p style={paperStyles.tocTitle}>Contents</p>
      <ul style={paperStyles.tocList}>
        {TOC_ITEMS.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => scrollTo(item.id)}
                style={{
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                  padding: '0.375rem 0.625rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                  transition: 'all 180ms var(--ease-out)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/* ─────────────────────── Phase Pipeline ─────────────────────── */

const PHASES = [
  {
    num: '01',
    name: 'Analyze',
    desc: 'Deterministic DDL parsing, catalog inspection, lock & risk scoring.',
  },
  {
    num: '02',
    name: 'Rehearse',
    desc: 'Isolated sandbox clone, schema diff, zero mutation on target.',
  },
  {
    num: '03',
    name: 'Approve',
    desc: 'SHA-256 cryptographic fingerprint binding; human sign-off gate.',
  },
  {
    num: '04',
    name: 'Execute',
    desc: 'Fail-closed DDL execution with transaction classification & timeouts.',
  },
  {
    num: '05',
    name: 'Verify',
    desc: 'Schema parity, connection pool, and index validity probes.',
  },
];

/* ─────────────────────── Main Page ─────────────────────── */

export const ResearchPage: React.FC = () => {
  const { navigate } = useRouter();
  const [activeId, setActiveId] = useState('abstract');

  /* Intersection observer to highlight active section in TOC */
  useEffect(() => {
    const ids = TOC_ITEMS.map((t) => t.id);
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id);
        },
        { rootMargin: '-20% 0px -65% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onOpenConsole={() => navigate('/console')} />

      {/* ── Hero ── */}
      <section style={paperStyles.hero}>
        <div style={paperStyles.heroInner}>
          <div style={paperStyles.badge}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
              }}
            />
            Technical Research Paper · 2026
          </div>

          <h1 style={paperStyles.title}>
            Orvexa: A Deterministic Safety Harness for Autonomous&nbsp;PostgreSQL Schema Migrations
          </h1>

          <p style={paperStyles.subtitle}>Analyze · Rehearse · Approve · Execute · Verify</p>

          <div style={paperStyles.authorsRow}>
            {['Toufiq Farhan', 'Orvexa Engineering Team'].map((name) => (
              <div key={name} style={paperStyles.authorCard}>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {name}
                </strong>
                Orvexa Platform
              </div>
            ))}
          </div>

          <div style={paperStyles.metaRow}>
            <span>August 2026</span>
            <span style={paperStyles.metaDot} />
            <span>PostgreSQL Safety</span>
            <span style={paperStyles.metaDot} />
            <span>Agent-Assisted DevOps</span>
            <span style={paperStyles.metaDot} />
            <span>Cryptographic Approval</span>
          </div>
        </div>
      </section>

      {/* ── Body: TOC + Paper ── */}
      <main style={{ flex: 1 }}>
        {/* Mobile: no sidebar */}
        <style>{`
          @media (max-width: 768px) {
            .paper-layout { grid-template-columns: 1fr !important; }
            .paper-toc { display: none; }
          }
        `}</style>

        <div className="paper-layout" style={paperStyles.layout}>
          <div className="paper-toc">
            <TableOfContents activeId={activeId} />
          </div>

          <article style={paperStyles.paper}>
            {/* ── Abstract ── */}
            <div id="abstract" style={paperStyles.abstract}>
              <p style={paperStyles.abstractLabel}>Abstract</p>
              <p style={{ ...paperStyles.body, marginBottom: 0, color: 'var(--text-secondary)' }}>
                Database schema migrations are a critical, high-risk operation in production
                software systems. Uncontrolled or insufficiently rehearsed migrations can cause data
                loss, prolonged table locks, and application downtime. This paper presents Orvexa, a
                deterministic safety harness that orchestrates PostgreSQL migrations through a
                structured five-phase lifecycle:{' '}
                <em>Analyze, Rehearse, Approve, Execute, Verify</em>. Orvexa combines deterministic
                static analysis, isolated sandbox rehearsal via Daytona workspace validation and
                disposable database cloning, cryptographic SHA-256 human approval gates,
                transaction-classified DDL execution, and automated post-execution verification
                probes. A multi-model AI layer powered by Google Gemini synthesizes technical
                telemetry into executive release briefs, while the TrueForge agent harness and Model
                Context Protocol (MCP) server enable agentic integration. Our evaluation
                demonstrates that Orvexa eliminates the category of production incidents caused by
                unreviewed, unrehearsed schema changes while maintaining acceptable execution
                latency for typical DDL workloads.
              </p>
            </div>

            {/* ── 1. Introduction ── */}
            <section id="introduction" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 1
              </p>
              <h2 style={paperStyles.sectionTitle}>Introduction</h2>
              <p style={paperStyles.body}>
                Modern production databases underpin virtually every user-facing application.
                PostgreSQL, one of the most widely deployed relational database engines, exposes a
                rich DDL surface that allows engineering teams to evolve their schema over time.
                However, the very expressiveness of DDL — <code>ALTER TABLE</code>,{' '}
                <code>DROP COLUMN</code>, concurrent index creation — introduces a class of
                operational hazards not present in ordinary application code deployments.
              </p>
              <p style={paperStyles.body}>
                Unlike a failed API deployment that can be rolled back with a container restart, a
                destructive schema migration may be partially applied, may hold an{' '}
                <code>ACCESS EXCLUSIVE</code> table lock for seconds or minutes while the operation
                runs, or may silently succeed while producing an inconsistent catalog state that is
                only discovered at query time. The rise of autonomous AI coding agents that generate
                and apply SQL migrations without human supervision amplifies this risk
                significantly.
              </p>
              <p style={paperStyles.body}>
                Orvexa was designed to address this gap. Rather than acting as an unchecked
                autonomous SQL executor, it functions as a{' '}
                <strong>deterministic safety harness</strong>: a structured pipeline that ensures
                every migration is analyzed, rehearsed in an isolated clone, fingerprint-approved by
                a human operator, executed with transaction safety, and verified against expected
                post-execution state before being marked complete.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 2. Problem Statement ── */}
            <section id="problem" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 2
              </p>
              <h2 style={paperStyles.sectionTitle}>Problem Statement</h2>
              <p style={paperStyles.body}>
                We identify four primary failure modes that Orvexa is designed to mitigate:
              </p>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>P1 — Unanalyzed Lock Severity</p>
                <p style={paperStyles.cardBody}>
                  DDL operations in PostgreSQL acquire different table-level locks depending on the
                  statement type. <code>ALTER TABLE ... ADD COLUMN DEFAULT</code> requires
                  <code>ACCESS EXCLUSIVE</code>, blocking all concurrent reads and writes for the
                  duration of the operation. Without static lock analysis, operators have no warning
                  before a migration that could block production traffic for minutes.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>P2 — No Rehearsal Evidence</p>
                <p style={paperStyles.cardBody}>
                  Traditional migration tooling (Flyway, Liquibase, Alembic) applies migrations
                  directly to the target database or a manually maintained staging environment.
                  There is no automated mechanism to capture the exact schema diff produced by the
                  migration against a realistic, isolated clone, and no guarantee the rehearsal
                  environment reflects the current production catalog.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>P3 — Weak or Absent Human Gates</p>
                <p style={paperStyles.cardBody}>
                  Approval workflows in most systems amount to a pull-request comment or a checkbox.
                  These approval artifacts are not cryptographically bound to the exact SQL being
                  approved. A post-approval modification to the migration SQL does not invalidate
                  the approval, creating a TOCTOU (time-of-check-time-of-use) vulnerability in the
                  approval chain.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>P4 — No Post-Execution Verification</p>
                <p style={paperStyles.cardBody}>
                  Even a successful SQL execution (no runtime errors) does not guarantee the
                  resulting catalog state matches the intended design. Index creation may succeed
                  but result in an invalid index (<code>indisvalid = false</code>). Schema diffs may
                  deviate from the rehearsed outcome due to concurrent schema modifications. Without
                  automated verification probes, these discrepancies go undetected.
                </p>
              </div>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 3. System Design ── */}
            <section id="system-design" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 3
              </p>
              <h2 style={paperStyles.sectionTitle}>System Design</h2>
              <p style={paperStyles.body}>
                Orvexa orchestrates all database operations through a deterministic five-phase
                lifecycle. Each phase is a distinct server-side state transition; sessions cannot
                skip phases or revert to earlier states without explicit operator action.
              </p>

              <div style={paperStyles.pipeline}>
                {PHASES.map((p) => (
                  <div key={p.num} style={paperStyles.phaseCard}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 40,
                        height: 40,
                        background: 'var(--accent-light)',
                        borderRadius: '0 var(--r-lg) 0 var(--r-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {p.num}
                    </div>
                    <p style={paperStyles.phaseNumber}>Phase {p.num}</p>
                    <p style={paperStyles.phaseName}>{p.name}</p>
                    <p style={paperStyles.phaseDesc}>{p.desc}</p>
                  </div>
                ))}
              </div>

              <p style={paperStyles.body}>
                <strong>Analyze</strong> parses raw DDL using a deterministic single-pass lexical
                tokenizer that handles single quotes, double quotes, PostgreSQL dollar-quoted string
                bodies (<code>{'$$...$$'}</code>), and SQL line/block comments. The parser maps each
                statement to a lock mode classification (<code>ACCESS EXCLUSIVE</code>,{' '}
                <code>SHARE UPDATE EXCLUSIVE</code>, <code>ACCESS SHARE</code>) and calculates
                composite risk scores across five risk categories: data loss, lock duration,
                performance impact, availability risk, and rollback complexity.
              </p>
              <p style={paperStyles.body}>
                <strong>Rehearse</strong> provisions a disposable PostgreSQL sibling database on the
                configured server, clones the target table definitions and synthetic fixtures into
                it, and applies the candidate migration exclusively against this disposable clone.
                Pre- and post-migration snapshots are captured and diffed to produce an exact
                structural change record. The live target database schema is guaranteed zero
                mutations during rehearsal.
              </p>
              <p style={paperStyles.body}>
                <strong>Approve</strong> transitions the session to <code>AWAITING_APPROVAL</code>{' '}
                and generates a deterministic SHA-256 cryptographic fingerprint that binds the
                proposed SQL hash, target database descriptor hash (engine, database name, schema
                name), rehearsal ID, and rehearsal status. Any post-approval modification to the SQL
                or target descriptor invalidates the fingerprint, preventing TOCTOU attacks.
              </p>
              <p style={paperStyles.body}>
                <strong>Execute</strong> acquires a single-flight execution lock, re-verifies the
                fingerprint against current state, classifies each statement as{' '}
                <code>TRANSACTION_SAFE</code> or <code>NON_TRANSACTIONAL</code>, enforces bounded
                statement timeouts, and applies DDL in the appropriate execution context (atomic{' '}
                <code>BEGIN...COMMIT</code> blocks or independent execution for
                concurrent/non-transactional statements). DML statements (<code>INSERT</code>,{' '}
                <code>UPDATE</code>, <code>DELETE</code>) are strictly rejected.
              </p>
              <p style={paperStyles.body}>
                <strong>Verify</strong> runs three automated probes against the target database
                after execution: schema parity (comparing post-execution diff against the approved
                rehearsal diff), connection pool responsiveness, and PostgreSQL index validity. Any
                probe failure marks the run as <code>VERIFICATION_FAILED</code>.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 4. Architecture ── */}
            <section id="architecture" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 4
              </p>
              <h2 style={paperStyles.sectionTitle}>Architecture</h2>
              <p style={paperStyles.body}>
                Orvexa is built on a monorepo architecture with three primary packages:
              </p>

              <div style={paperStyles.tableWrap}>
                <table style={paperStyles.table}>
                  <thead>
                    <tr>
                      <th style={paperStyles.th}>Component</th>
                      <th style={paperStyles.th}>Technology</th>
                      <th style={paperStyles.th}>Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        'apps/web',
                        'React 19 + Vite + TypeScript',
                        'Interactive migration console and landing page',
                      ],
                      [
                        'apps/server',
                        'Node.js + Express + TypeScript',
                        'REST API, lifecycle engine, MCP server',
                      ],
                      [
                        'packages/shared',
                        'TypeScript',
                        'Shared DTOs, type contracts, health check protocol',
                      ],
                      [
                        'TrueForge SDK',
                        '@truefoundry/trueforge-sdk',
                        'Agent harness, model dispatch, session lifecycle',
                      ],
                      [
                        'Daytona SDK',
                        '@daytona/sdk',
                        'Sandbox workspace verification and remote environment dispatch',
                      ],
                      [
                        'Google Gemini',
                        'gemini-2.5-flash / gemini-2.5-pro',
                        'Executive release brief synthesis',
                      ],
                      [
                        'MCP Server',
                        'SSE Transport at /api/mcp',
                        'Agentic tool exposure for AI coding agents',
                      ],
                    ].map(([comp, tech, resp]) => (
                      <tr key={comp}>
                        <td
                          style={{
                            ...paperStyles.td,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                          }}
                        >
                          {comp}
                        </td>
                        <td style={paperStyles.td}>{tech}</td>
                        <td style={paperStyles.td}>{resp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={paperStyles.body}>
                The backend exposes a REST API under <code>/api/migrations/*</code> that drives each
                lifecycle phase. Session state is maintained in-process (for the hackathon
                prototype) and all state transitions are validated server-side with strict
                precondition enforcement. The frontend React application communicates exclusively
                through this API, with no direct database access from the browser.
              </p>

              <div style={paperStyles.codeBlock}>
                <span style={paperStyles.codeComment}>
                  {'// Authoritative MigrationSessionStatus lifecycle'}
                </span>
                {'\n'}
                <span style={paperStyles.codeKeyword}>type</span>
                {' MigrationSessionStatus = \n'}
                {'  | '}
                <span style={paperStyles.codeString}>"DRAFT"</span>
                {' | '}
                <span style={paperStyles.codeString}>"ANALYZING"</span>
                {' | '}
                <span style={paperStyles.codeString}>"ANALYSIS_FAILED"</span>
                {'\n  | '}
                <span style={paperStyles.codeString}>"SANDBOX_READY"</span>
                {' | '}
                <span style={paperStyles.codeString}>"SANDBOX_RUNNING"</span>
                {' | '}
                <span style={paperStyles.codeString}>"SANDBOX_REHEARSAL_COMPLETED"</span>
                {'\n  | '}
                <span style={paperStyles.codeString}>"AWAITING_APPROVAL"</span>
                {' | '}
                <span style={paperStyles.codeString}>"APPROVED"</span>
                {' | '}
                <span style={paperStyles.codeString}>"REJECTED"</span>
                {'\n  | '}
                <span style={paperStyles.codeString}>"EXECUTING"</span>
                {' | '}
                <span style={paperStyles.codeString}>"EXECUTION_FAILED"</span>
                {'\n  | '}
                <span style={paperStyles.codeString}>"VERIFYING"</span>
                {' | '}
                <span style={paperStyles.codeString}>"VERIFICATION_FAILED"</span>
                {' | '}
                <span style={paperStyles.codeString}>"COMPLETED"</span>
                {';'}
              </div>

              <p style={paperStyles.body}>
                The MCP server exposes three tools over SSE transport:{' '}
                <code>inspect_postgres_target</code>
                (live catalog inspection without locks), <code>simulate_lock_contention</code>
                (pre-execution lock risk evaluation), and <code>generate_recipe</code>
                (safe zero-downtime migration recipe generation). These tools enable AI coding
                agents (Claude Code, Gemini CLI, etc.) to integrate Orvexa's safety intelligence
                directly into their tool-calling loop.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 5. Safety Model ── */}
            <section id="safety-model" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 5
              </p>
              <h2 style={paperStyles.sectionTitle}>Safety Model</h2>
              <p style={paperStyles.body}>
                Orvexa's safety model is built around four core invariants that hold throughout the
                lifecycle:
              </p>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>
                  I1 — Target Database Immutability During Rehearsal
                </p>
                <p style={paperStyles.cardBody}>
                  All rehearsal DDL executes exclusively against a disposable sibling database. The
                  live target database schema receives zero mutations during the Rehearse phase.
                  This invariant is enforced at the connection routing layer, not just by
                  convention.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>I2 — Cryptographic Approval Binding</p>
                <p style={paperStyles.cardBody}>
                  The SHA-256 approval fingerprint is computed as:
                  <br />
                  <code>
                    SHA256(migrationId || sqlHash || targetDescriptorHash || rehearsalId ||
                    rehearsalStatus)
                  </code>
                  <br />
                  <br />
                  This binds the approval to a specific SQL payload, a specific target database
                  descriptor, and a specific successful rehearsal. Any post-approval SQL edit,
                  target database switch, or re-rehearsal invalidates the fingerprint and blocks
                  execution.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>I3 — Fail-Closed Pre-Execution Gating</p>
                <p style={paperStyles.cardBody}>
                  Pre-execution safety checks are strictly fail-closed: any fingerprint mismatch,
                  unrehearsed state, execution lock contention, or transaction classification hazard
                  halts the pipeline and aborts execution with no fallback path. For post-execution
                  verification, probe failures mark the session as <code>VERIFICATION_FAILED</code>{' '}
                  to alert operators and guard against silent schema degradation, while permitting
                  operator re-verification probes or explicit manual reconciliation to{' '}
                  <code>COMPLETED</code>.
                </p>
              </div>

              <div style={paperStyles.card}>
                <p style={paperStyles.cardTitle}>I4 — Single-Session Execution Exclusivity</p>
                <p style={paperStyles.cardBody}>
                  A per-session execution lock prevents concurrent execution attempts. Combined with
                  explicit <code>confirmExecution: true</code> at the API boundary, this eliminates
                  double-execution races that could produce partial schema states.
                </p>
              </div>

              <p style={{ ...paperStyles.body, marginTop: '1.25rem' }}>
                Additional hardening measures include: DML rejection (INSERT/UPDATE/DELETE are
                blocked at the statement classifier), identifier injection validation, bounded
                statement timeouts (1ms–600,000ms), credential sanitization in all public DTOs and
                logs, and a strict Content Security Policy that permits only Vite bundles, Google
                Fonts, and data URIs.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 6. Evaluation ── */}
            <section id="evaluation" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 6
              </p>
              <h2 style={paperStyles.sectionTitle}>Evaluation</h2>
              <p style={paperStyles.body}>
                We evaluated Orvexa against eight canonical migration presets designed around a
                representative PostgreSQL multi-tenant schema (organizations, users, events, orders
                tables). The presets span the full risk spectrum from safe additive operations to
                high-risk destructive mutations.
              </p>

              <div style={paperStyles.tableWrap}>
                <table style={paperStyles.table}>
                  <thead>
                    <tr>
                      <th style={paperStyles.th}>Preset</th>
                      <th style={paperStyles.th}>Risk Class</th>
                      <th style={paperStyles.th}>Lock Mode</th>
                      <th style={paperStyles.th}>Transaction Safe</th>
                      <th style={paperStyles.th}>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Create Baseline Table', 'Low', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                      ['Safe Add Column', 'Low', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                      ['Concurrent Index', 'Medium', 'SHARE UPDATE EXCLUSIVE', 'No*', '✓'],
                      ['Add JSON Column', 'Low', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                      [
                        'Check Constraint (NOT VALID)',
                        'Low–Medium',
                        'ACCESS EXCLUSIVE',
                        'Yes',
                        '✓',
                      ],
                      ['Multi-Column Batch', 'Low', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                      ['Destructive Drop Column', 'High', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                      ['Alter Column Type', 'High', 'ACCESS EXCLUSIVE', 'Yes', '✓'],
                    ].map(([preset, risk, lock, txn, verified]) => (
                      <tr key={preset}>
                        <td style={paperStyles.td}>{preset}</td>
                        <td
                          style={{
                            ...paperStyles.td,
                            color:
                              risk === 'High'
                                ? 'var(--red)'
                                : risk === 'Medium' || risk === 'Low–Medium'
                                  ? 'var(--amber)'
                                  : 'var(--green)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          }}
                        >
                          {risk}
                        </td>
                        <td
                          style={{
                            ...paperStyles.td,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {lock}
                        </td>
                        <td style={paperStyles.td}>{txn}</td>
                        <td style={{ ...paperStyles.td, color: 'var(--green)', fontWeight: 700 }}>
                          {verified}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '1.25rem',
                }}
              >
                * CREATE INDEX CONCURRENTLY is classified NON_TRANSACTIONAL and executed outside a
                transaction block as required by PostgreSQL.
              </p>

              <p style={paperStyles.body}>
                All eight presets successfully completed the full five-phase lifecycle. The
                verification probes (SCHEMA_PARITY, CONNECTION_POOL, INDEX_VALIDITY) passed for all
                runs. The high-risk presets (Destructive Drop, Alter Column Type) were correctly
                classified with elevated risk scores and required explicit human approval before
                execution could proceed, demonstrating the effectiveness of the approval gate.
              </p>
              <p style={paperStyles.body}>
                The Google Gemini executive brief synthesis, triggered for each preset, correctly
                identified lock risks, suggested maintenance windows for high-risk operations, and
                recommended backup precautions for destructive mutations. The single-flight
                protection mechanism successfully prevented duplicate brief generation in concurrent
                console test scenarios.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 7. Related Work ── */}
            <section id="related-work" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 7
              </p>
              <h2 style={paperStyles.sectionTitle}>Related Work</h2>
              <p style={paperStyles.body}>
                <strong>Migration tooling</strong>. Flyway [1], Liquibase [2], and Alembic [3]
                provide schema versioning and migration sequencing but do not perform lock analysis,
                sandbox rehearsal, or cryptographic approval. They apply migrations to configured
                target databases directly without an isolation safety layer.
              </p>
              <p style={paperStyles.body}>
                <strong>Safe schema change frameworks</strong>. gh-ost [4] and
                pt-online-schema-change [5] address zero-downtime ALTER TABLE operations for MySQL
                by using triggers and shadow tables. These are MySQL-specific and do not generalize
                to PostgreSQL's DDL surface or provide a full lifecycle harness.
              </p>
              <p style={paperStyles.body}>
                <strong>Agent-assisted database tooling</strong>. The emergence of AI coding agents
                (GitHub Copilot, Claude Code, Gemini CLI) capable of generating and applying SQL
                migrations creates new safety demands. Model Context Protocol [6] provides a
                standardized transport for exposing tool capabilities to agents; Orvexa's MCP server
                is one of the first implementations focused specifically on database migration
                safety intelligence.
              </p>
              <p style={paperStyles.body}>
                <strong>Sandbox environments</strong>. Daytona [7] provides ephemeral, isolated
                development workspace provisioning. Orvexa integrates Daytona via TrueForge to
                validate isolated workspace dispatch and environment readiness, while migration
                statements execute against an isolated disposable PostgreSQL sibling database to
                guarantee target database immutability.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── 8. Conclusion ── */}
            <section id="conclusion" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> Section 8
              </p>
              <h2 style={paperStyles.sectionTitle}>Conclusion</h2>
              <p style={paperStyles.body}>
                This paper introduced Orvexa, a deterministic safety harness for autonomous
                PostgreSQL schema migrations. By combining deterministic static analysis, isolated
                sandbox rehearsal, cryptographic human approval binding, fail-closed DDL execution,
                and automated post-execution verification, Orvexa addresses the four primary failure
                modes identified in production migration workflows.
              </p>
              <p style={paperStyles.body}>
                The system's multi-model AI integration (Google Gemini via TrueForge) provides
                human-readable executive synthesis of technical migration telemetry, lowering the
                barrier for non-specialist approvers to make informed decisions about high-risk
                migrations. The MCP server exposes Orvexa's safety intelligence as first-class tools
                for AI coding agents, enabling agent-native safety integration.
              </p>
              <p style={paperStyles.body}>
                Future work includes distributed session persistence (replacing the current
                in-process session store), row-level fixture sampling for more realistic rehearsal
                datasets, and automated rollback plan generation for destructive migrations. We also
                intend to extend the MCP tool surface to cover migration sequencing analysis and
                cross-migration dependency resolution.
              </p>
            </section>

            <hr style={paperStyles.divider} />

            {/* ── References ── */}
            <section id="references" style={paperStyles.section}>
              <p style={paperStyles.sectionLabel}>
                <span>§</span> References
              </p>
              <h2 style={paperStyles.sectionTitle}>References</h2>

              {[
                ['1', 'Flyway by Redgate. Database migrations made easy. https://flywaydb.org'],
                ['2', 'Liquibase. Database schema change management. https://www.liquibase.org'],
                [
                  '3',
                  'SQLAlchemy Alembic. Lightweight database migration tool for SQLAlchemy. https://alembic.sqlalchemy.org',
                ],
                [
                  '4',
                  "GitHub. gh-ost: GitHub's online schema change tool for MySQL. https://github.com/github/gh-ost",
                ],
                [
                  '5',
                  'Percona. pt-online-schema-change: ALTER tables without locking them. https://www.percona.com/software/database-tools/percona-toolkit',
                ],
                ['6', 'Anthropic. Model Context Protocol. https://modelcontextprotocol.io'],
                [
                  '7',
                  'Daytona. The Open-Source Development Environment Manager. https://www.daytona.io',
                ],
                [
                  '8',
                  'TrueFoundry. TrueForge: Agent harness for multi-model AI systems. https://truefoundry.com',
                ],
                [
                  '9',
                  'Google. Gemini 2.5 Flash — Adaptive thinking, cost efficiency. https://deepmind.google/models/gemini',
                ],
                [
                  '10',
                  'PostgreSQL Global Development Group. PostgreSQL 16 Documentation: DDL — Data Definition. https://www.postgresql.org/docs/16/ddl.html',
                ],
              ].map(([idx, text]) => (
                <div key={idx} style={paperStyles.refItem}>
                  <span style={paperStyles.refIndex}>[{idx}]</span>
                  {text}
                </div>
              ))}
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
};
