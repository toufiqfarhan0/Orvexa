import React, { useState } from 'react';
import {
  Copy,
  Trash,
  Check,
  CodeBlock,
  CaretDown,
  CaretRight,
  Sparkle,
  Play,
  Cube,
  ShieldCheck,
  CircleNotch,
} from '@phosphor-icons/react';

interface SqlEditorPanelProps {
  sql: string;
  onChange: (value: string) => void;
  appliedSqls?: string[];
  disabled?: boolean;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  needsNewSession?: boolean;
  onStartRehearsal?: () => void;
  isRehearsing?: boolean;
  onRequestApproval?: () => void;
  isApproving?: boolean;
  onScrollToApproval?: () => void;
  statusHint?: string;
}

export interface MigrationPreset {
  id: string;
  category: 'all' | 'safe' | 'constraint' | 'destructive' | 'baseline';
  step: string;
  title: string;
  badge: string;
  badgeClass: string;
  sql: string;
  description: string;
}

export const MIGRATION_PRESETS: MigrationPreset[] = [
  {
    id: 'p1_baseline',
    category: 'baseline',
    step: 'Step 1',
    title: 'Create Baseline Table',
    badge: 'Baseline DDL',
    badgeClass: 'badge-neutral',
    sql: `CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);`,
    description: 'Initializes baseline public.events table if not already created on target DB',
  },
  {
    id: 'p2_add_column',
    category: 'safe',
    step: 'Step 2',
    title: 'Safe Add Column',
    badge: 'Low Risk',
    badgeClass: 'badge-green',
    sql: `ALTER TABLE public.events
ADD COLUMN status text NOT NULL DEFAULT 'active';`,
    description: 'Safe non-breaking additive column migration',
  },
  {
    id: 'p3_concurrent_index',
    category: 'constraint',
    step: 'Step 3',
    title: 'Concurrent Index',
    badge: 'Zero Lock',
    badgeClass: 'badge-blue',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type
ON public.events(event_type);`,
    description: 'Creates concurrent index without table locking',
  },
  {
    id: 'p4_not_null_column',
    category: 'safe',
    step: 'Step 4',
    title: 'Add JSON Column',
    badge: 'Low Risk',
    badgeClass: 'badge-green',
    sql: `ALTER TABLE public.events
ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    description: 'Adds non-null metadata column with fast constant default',
  },
  {
    id: 'p5_check_constraint',
    category: 'constraint',
    step: 'Step 5',
    title: 'Check Constraint',
    badge: 'Validation',
    badgeClass: 'badge-blue',
    sql: `ALTER TABLE public.orders
ADD CONSTRAINT chk_orders_amount_positive
CHECK (total_amount >= 0) NOT VALID;`,
    description: 'Adds NOT VALID constraint to avoid scanning all rows immediately',
  },
  {
    id: 'p6_batch_columns',
    category: 'safe',
    step: 'Step 6',
    title: 'Multi-Column Batch',
    badge: 'Multi-Stmt',
    badgeClass: 'badge-green',
    sql: `ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS avatar_url text;`,
    description: 'Atomically adds multiple user profile columns in one transaction',
  },
  {
    id: 'p7_destructive_drop',
    category: 'destructive',
    step: 'Step 7',
    title: 'Destructive Drop',
    badge: 'Breaking',
    badgeClass: 'badge-red',
    sql: `ALTER TABLE public.events
DROP COLUMN IF EXISTS payload;`,
    description: 'Simulates intentional high-risk destructive drop to verify approval gate',
  },
  {
    id: 'p8_type_mutation',
    category: 'destructive',
    step: 'Step 8',
    title: 'Alter Column Type',
    badge: 'Full Rewrite',
    badgeClass: 'badge-red',
    sql: `ALTER TABLE public.orders
ALTER COLUMN status TYPE varchar(32);`,
    description: 'Triggers table lock evaluation and full row scan risk check',
  },
];

const PRESET_CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'safe', label: 'Safe Additive' },
  { id: 'constraint', label: 'Constraints & Indexes' },
  { id: 'destructive', label: 'Destructive Mutations' },
  { id: 'baseline', label: 'Baseline Setup' },
] as const;

/**
 * Normalizes SQL for local applied-state comparison.
 * Conservative normalization using single-pass lexical scanning:
 * - Preserves string literals and comment-like text inside quotes without placeholder substitution
 * - Strips line comments (-- ...) and block comments (/* ... *\/) outside string literals
 * - Removes statement terminators (;)
 * - Normalizes and collapses whitespace
 * - Folds casing consistently
 */
export const normalizeSql = (text: string): string => {
  if (!text) return '';
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    // 1. Single-quoted string literal
    if (text[i] === "'") {
      result += "'";
      i++;
      while (i < len) {
        if (text[i] === "'") {
          result += "'";
          i++;
          if (i < len && text[i] === "'") {
            // Escaped quote ''
            result += "'";
            i++;
          } else {
            break;
          }
        } else {
          result += text[i];
          i++;
        }
      }
    }
    // 2. PostgreSQL dollar-quoted string literal ($$ ... $$ or $tag$ ... $tag$)
    else if (text[i] === '$') {
      const match = text.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        const tag = match[0]; // e.g. "$$" or "$func$"
        result += tag;
        i += tag.length;
        const closeIdx = text.indexOf(tag, i);
        if (closeIdx !== -1) {
          result += text.slice(i, closeIdx) + tag;
          i = closeIdx + tag.length;
        } else {
          result += text.slice(i);
          i = len;
        }
      } else {
        result += text[i];
        i++;
      }
    }
    // 3. Line comment --
    else if (text[i] === '-' && i + 1 < len && text[i + 1] === '-') {
      i += 2;
      while (i < len && text[i] !== '\n' && text[i] !== '\r') {
        i++;
      }
    }
    // 4. Block comment /* ... */
    else if (text[i] === '/' && i + 1 < len && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2; // skip */
    }
    // 5. Semicolon
    else if (text[i] === ';') {
      i++;
    }
    // 6. Normal character
    else {
      result += text[i];
      i++;
    }
  }

  return result.replace(/\s+/g, ' ').trim().toLowerCase();
};

export const SqlEditorPanel: React.FC<SqlEditorPanelProps> = ({
  sql,
  onChange,
  appliedSqls = [],
  disabled = false,
  onAnalyze,
  isAnalyzing = false,
  needsNewSession = true,
  onStartRehearsal,
  isRehearsing = false,
  onRequestApproval,
  isApproving = false,
  onScrollToApproval,
  statusHint,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPresetsExpanded, setIsPresetsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const lines = sql.split('\n');
  const lineCount = Math.max(lines.length, 6);

  const handleCopy = async () => {
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  const handleInsertTemplate = (templateSql: string) => {
    if (disabled) return;
    onChange(templateSql);
  };

  const isCurrentSqlApplied = appliedSqls.some(
    (applied) => normalizeSql(applied) === normalizeSql(sql)
  );

  const filteredPresets =
    activeCategory === 'all'
      ? MIGRATION_PRESETS
      : MIGRATION_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="c-card">
      {/* Editor Header / Controls */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <div className="c-icon-box">
            <CodeBlock size={16} color="var(--accent)" weight="bold" />
          </div>
          <h2
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Migration DDL Input
          </h2>
          <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
            PostgreSQL 16
          </span>
          {isCurrentSqlApplied && (
            <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>
              <Check size={11} weight="bold" /> Applied on Target
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setIsPresetsExpanded(!isPresetsExpanded)}
            className={`btn ${isPresetsExpanded ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
          >
            <Sparkle size={13} />
            <span>Templates ({MIGRATION_PRESETS.length})</span>
            {isPresetsExpanded ? <CaretDown size={11} /> : <CaretRight size={11} />}
          </button>

          <button
            onClick={handleCopy}
            disabled={!sql}
            className="btn btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
            title="Copy SQL to clipboard"
          >
            {copied ? <Check size={13} color="var(--green)" weight="bold" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClear}
            disabled={!sql || disabled}
            className="btn btn-ghost"
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.5rem',
              color: sql && !disabled ? 'var(--red)' : 'var(--text-muted)',
              opacity: disabled ? 0.5 : 1,
            }}
            title="Clear editor contents"
          >
            <Trash size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Expandable Templates Section */}
      {isPresetsExpanded && (
        <div
          style={{
            borderBottom: '1px solid var(--border-faint)',
            background: 'var(--bg-elevated)',
          }}
        >
          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.375rem',
              padding: '0.75rem 1.25rem 0.5rem',
              overflowX: 'auto',
              flexWrap: 'wrap',
            }}
          >
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`preset-pill ${activeCategory === cat.id ? 'active' : ''}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.625rem',
              padding: '0.5rem 1.25rem 1rem',
            }}
          >
            {filteredPresets.map((preset) => {
              const isSelected = normalizeSql(sql) === normalizeSql(preset.sql);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleInsertTemplate(preset.sql)}
                  disabled={disabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    gap: '0.375rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-surface)',
                    border: isSelected
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                    boxShadow: isSelected ? 'var(--shadow-blue)' : 'var(--shadow-xs)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {preset.step}: {preset.title}
                    </span>
                    <span
                      className={`badge ${preset.badgeClass}`}
                      style={{
                        fontSize: '0.625rem',
                        padding: '0.15rem 0.45rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            background: '#0e1726',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            minHeight: '220px',
          }}
        >
          {/* Line Numbers Column */}
          <div
            style={{
              padding: '0.875rem 0.75rem',
              background: '#090f1a',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'right',
              userSelect: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: '#475569',
              minWidth: '42px',
            }}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Multiline Textarea */}
          <textarea
            value={sql}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={`-- Paste your PostgreSQL migration DDL statements here or choose from Templates (8) >\n-- e.g. ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';`}
            aria-label="PostgreSQL Migration DDL"
            spellCheck={false}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#e2e8f0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              padding: '0.875rem 1rem',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              minHeight: '220px',
              tabSize: 2,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
        </div>

        {/* Editor Footer / Integrated Command Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-faint)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span>Lines: {sql ? lines.length : 0}</span>
            <span>Chars: {sql.length}</span>
            {statusHint && (
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
                title={statusHint}
              >
                · {statusHint}
              </span>
            )}
          </div>

          {/* Action CTAs */}
          {onAnalyze && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Primary Analyze Button - hide when awaiting approval unless SQL modified */}
              {(!onScrollToApproval || needsNewSession) && (
                <button
                  onClick={onAnalyze}
                  disabled={!sql.trim() || disabled || isAnalyzing || isRehearsing || isApproving}
                  className="btn btn-outline"
                  id="analyze-migration-btn"
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    opacity:
                      !sql.trim() || disabled || isAnalyzing || isRehearsing || isApproving
                        ? 0.6
                        : 1,
                    cursor:
                      !sql.trim() || disabled || isAnalyzing || isRehearsing || isApproving
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {isAnalyzing ? (
                    <CircleNotch
                      size={13}
                      weight="bold"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                  ) : (
                    <Play size={13} weight="fill" />
                  )}
                  <span>
                    {isAnalyzing
                      ? 'Analyzing AST...'
                      : needsNewSession
                        ? 'Analyze Migration'
                        : 'Re-Analyze Migration'}
                  </span>
                </button>
              )}

              {/* Start Rehearsal CTA */}
              {onStartRehearsal && (
                <button
                  onClick={onStartRehearsal}
                  disabled={disabled || isAnalyzing || isRehearsing || isApproving}
                  className="btn btn-accent"
                  id="start-rehearsal-btn"
                  style={{
                    padding: '0.45rem 1.125rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    opacity: isRehearsing ? 0.7 : 1,
                    cursor: isRehearsing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {isRehearsing ? (
                    <CircleNotch
                      size={13}
                      weight="bold"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                  ) : (
                    <Cube size={13} weight="fill" />
                  )}
                  <span>{isRehearsing ? 'Running Sandbox...' : 'Start Sandbox Rehearsal'}</span>
                </button>
              )}

              {/* Request Approval CTA */}
              {onRequestApproval && (
                <button
                  onClick={onRequestApproval}
                  disabled={disabled || isApproving || isAnalyzing || isRehearsing}
                  className="btn btn-primary"
                  id="request-approval-btn"
                  style={{
                    padding: '0.45rem 1.125rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    opacity: isApproving ? 0.75 : 1,
                    cursor: isApproving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  {isApproving ? (
                    <>
                      <CircleNotch
                        size={13}
                        weight="bold"
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                      <span>Requesting Approval...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} weight="bold" />
                      <span>Request Human Approval</span>
                    </>
                  )}
                </button>
              )}

              {/* Scroll to Approval Gate CTA */}
              {onScrollToApproval && (
                <button
                  type="button"
                  onClick={onScrollToApproval}
                  className="btn btn-primary"
                  id="scroll-to-approval-btn"
                  style={{
                    padding: '0.45rem 1.125rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                  title="Scroll down to Human Approval Gate"
                >
                  <ShieldCheck size={13} weight="bold" />
                  <span>Scroll to Approval Gate</span>
                  <CaretDown size={12} weight="bold" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
