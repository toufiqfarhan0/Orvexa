import React, { useState } from 'react';
import { Copy, Trash, Check, CodeBlock, CaretDown, CaretRight } from '@phosphor-icons/react';

interface SqlEditorPanelProps {
  sql: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface MigrationPreset {
  id: string;
  category: 'all' | 'safe' | 'constraint' | 'destructive' | 'baseline';
  step: string;
  title: string;
  badge: string;
  badgeColor: string;
  sql: string;
  description: string;
}

export const MIGRATION_PRESETS: MigrationPreset[] = [
  {
    id: 'p1_baseline',
    category: 'baseline',
    step: 'Step 1: Baseline Table',
    title: 'Create Table',
    badge: 'Baseline DDL',
    badgeColor: 'var(--text-secondary)',
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
    step: 'Step 2: Safe Add Column',
    title: 'Add Column',
    badge: 'Low Risk',
    badgeColor: 'var(--status-success)',
    sql: `ALTER TABLE public.events
ADD COLUMN status text NOT NULL DEFAULT 'active';`,
    description: 'Safe non-breaking additive column migration',
  },
  {
    id: 'p3_concurrent_index',
    category: 'constraint',
    step: 'Step 3: Concurrent Index',
    title: 'Create Index',
    badge: 'Zero Lock',
    badgeColor: 'var(--accent)',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type
ON public.events(event_type);`,
    description: 'Creates concurrent index without table locking',
  },
  {
    id: 'p4_not_null_column',
    category: 'safe',
    step: 'Step 4: Add Metadata Col',
    title: 'Add JSON Column',
    badge: 'Low Risk',
    badgeColor: 'var(--status-success)',
    sql: `ALTER TABLE public.events
ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    description: 'Adds non-null metadata column with fast constant default',
  },
  {
    id: 'p5_check_constraint',
    category: 'constraint',
    step: 'Step 5: Add Constraint',
    title: 'Check Constraint',
    badge: 'Validation',
    badgeColor: 'var(--accent)',
    sql: `ALTER TABLE public.orders
ADD CONSTRAINT chk_orders_amount_positive
CHECK (total_amount >= 0) NOT VALID;`,
    description: 'Adds NOT VALID constraint to avoid scanning all rows immediately',
  },
  {
    id: 'p6_batch_columns',
    category: 'safe',
    step: 'Step 6: Batch Expansion',
    title: 'Multi-Column Batch',
    badge: 'Multi-Stmt',
    badgeColor: 'var(--status-success)',
    sql: `ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS avatar_url text;`,
    description: 'Atomically adds multiple user profile columns in one transaction',
  },
  {
    id: 'p7_destructive_drop',
    category: 'destructive',
    step: 'Step 7: Destructive Drop',
    title: 'Drop Column',
    badge: 'High Risk',
    badgeColor: 'var(--status-error)',
    sql: `ALTER TABLE public.events
DROP COLUMN IF EXISTS payload;`,
    description: 'Destructive DDL triggering strict safety gates & human approval',
  },
  {
    id: 'p8_table_rename',
    category: 'destructive',
    step: 'Step 8: Table Rename',
    title: 'Rename Table',
    badge: 'Breaking DDL',
    badgeColor: 'var(--status-error)',
    sql: `ALTER TABLE public.orders
RENAME TO customer_orders;`,
    description: 'Breaking catalog rename requiring exclusive metadata locks',
  },
];

interface SqlEditorPanelProps {
  sql: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  appliedSqls?: string[];
}

export const normalizeSql = (str: string): string =>
  str
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const SqlEditorPanel: React.FC<SqlEditorPanelProps> = ({
  sql,
  onChange,
  disabled = false,
  appliedSqls = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isPresetsExpanded, setIsPresetsExpanded] = useState<boolean>(false);

  const lines = sql ? sql.split('\n') : [''];
  const lineCount = Math.max(lines.length, 6);

  const handleCopy = async () => {
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
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
    <div
      className="panel-elevated"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        border: '1px solid var(--border-medium)',
      }}
    >
      {/* Editor Header / Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CodeBlock size={18} color="var(--accent)" weight="bold" />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Migration DDL Input</h2>
          <span
            className="badge badge-neutral"
            style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem' }}
          >
            PostgreSQL DDL
          </span>
          {isCurrentSqlApplied && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--status-success)',
                backgroundColor: 'var(--status-success-bg)',
                border: '1px solid var(--status-success-border)',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-badge)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Check size={12} weight="bold" /> Applied in DB
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            disabled={!sql}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            title="Copy SQL to clipboard"
            aria-label="Copy SQL text"
          >
            {copied ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleClear}
            disabled={!sql || disabled}
            className="btn btn-ghost"
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              color: sql && !disabled ? 'var(--status-error)' : 'var(--text-muted)',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            title={disabled ? 'Editor is locked during analysis' : 'Clear editor contents'}
            aria-label="Clear SQL editor"
          >
            <Trash size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Migration Query Steps / Presets Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsPresetsExpanded((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
              title={isPresetsExpanded ? 'Collapse templates' : 'Expand templates'}
            >
              {isPresetsExpanded ? (
                <CaretDown size={14} weight="bold" color="var(--accent)" />
              ) : (
                <CaretRight size={14} weight="bold" color="var(--text-muted)" />
              )}
              <span>Quick Migration Templates & Scenarios ({MIGRATION_PRESETS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPresetsExpanded((prev) => !prev)}
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-badge)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {isPresetsExpanded ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Category Filter Pills (Shown only when expanded) */}
          {isPresetsExpanded && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}
            >
              {[
                { id: 'all', label: 'All (8)' },
                { id: 'safe', label: 'Safe Additive' },
                { id: 'constraint', label: 'Constraints & Indexes' },
                { id: 'destructive', label: 'High Risk DDL' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: activeCategory === tab.id ? 700 : 500,
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-badge)',
                    border:
                      activeCategory === tab.id
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-subtle)',
                    backgroundColor:
                      activeCategory === tab.id ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: activeCategory === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expandable Body: Presets Grid, Applied Status Banner, and 5 Variations */}
        {isPresetsExpanded && (
          <>
            {/* Presets Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {filteredPresets.map((preset) => {
                const isSelected = normalizeSql(sql) === normalizeSql(preset.sql);
                const isApplied = appliedSqls.some(
                  (applied) => normalizeSql(applied) === normalizeSql(preset.sql)
                );

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
                      gap: '0.25rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                      border: isSelected
                        ? '1.5px solid var(--accent)'
                        : isApplied
                          ? '1px solid var(--status-success-border)'
                          : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      opacity: disabled ? 0.5 : 1,
                      position: 'relative',
                    }}
                    title={preset.description}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        gap: '0.25rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        {preset.step}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {isApplied && (
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              color: 'var(--status-success)',
                              backgroundColor: 'var(--status-success-bg)',
                              padding: '0.05rem 0.25rem',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Already applied on database"
                          >
                            ✓ DB
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: preset.badgeColor,
                            textTransform: 'uppercase',
                            padding: '0.05rem 0.3rem',
                            borderRadius: '3px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                          }}
                        >
                          {preset.badge}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Informational Banner when Current Template is already applied */}
            {isCurrentSqlApplied && (
              <div
                style={{
                  padding: '0.45rem 0.75rem',
                  backgroundColor: 'var(--status-success-bg)',
                  border: '1px solid var(--status-success-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Check size={14} color="var(--status-success)" weight="bold" />
                <span>
                  <strong>Target Database Status:</strong> This migration statement was previously
                  applied to the connected database. You can edit/modify the SQL directly or pick
                  another variation below.
                </span>
              </div>
            )}

            {/* 5 Quick Query Variations & Modifications */}
            <div
              style={{
                padding: '0.625rem 0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <span>
                  💡 <strong>Modify or Alter Freely:</strong> You can edit the SQL directly in the
                  editor above, or click any of these <strong>5 custom query variations</strong>:
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  {
                    title: 'Add Priority Column',
                    tag: 'Integer Default',
                    sql: `ALTER TABLE public.events\nADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 1;`,
                    desc: 'Adds priority column with integer constant default',
                  },
                  {
                    title: 'Rename Column',
                    tag: 'Metadata Rename',
                    sql: `ALTER TABLE public.events\nRENAME COLUMN status TO event_status;`,
                    desc: 'Renames status column to event_status',
                  },
                  {
                    title: 'Multi-Column Composite Index',
                    tag: 'Composite Index',
                    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status\nON public.orders(user_id, status);`,
                    desc: 'Creates composite index on user_id and status without lock',
                  },
                  {
                    title: 'Alter Nullability',
                    tag: 'Drop NOT NULL',
                    sql: `ALTER TABLE public.users\nALTER COLUMN full_name DROP NOT NULL;`,
                    desc: 'Relaxes full_name nullability constraint',
                  },
                  {
                    title: 'Add Foreign Key Constraint',
                    tag: 'Foreign Key',
                    sql: `ALTER TABLE public.events\nADD CONSTRAINT fk_events_user\nFOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;`,
                    desc: 'Adds foreign key reference between events and users',
                  },
                ].map((variant, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertTemplate(variant.sql)}
                    disabled={disabled}
                    className="btn btn-ghost"
                    style={{
                      fontSize: '0.6875rem',
                      padding: '0.25rem 0.5rem',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-badge)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={variant.desc}
                  >
                    <span>{variant.title}</span>
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        color: 'var(--accent)',
                        fontWeight: 700,
                      }}
                    >
                      +{variant.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Editor Body */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          backgroundColor: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          minHeight: '220px',
        }}
      >
        {/* Line Numbers Column */}
        <div
          style={{
            padding: '0.875rem 0.625rem',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'right',
            userSelect: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            color: '#94a3b8',
            minWidth: '40px',
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
          placeholder={`ALTER TABLE public.events\nADD COLUMN example integer NOT NULL DEFAULT 0;`}
          aria-label="PostgreSQL Migration DDL"
          spellCheck={false}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            color: '#f1f5f9',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
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

      {/* Editor Footer / Telemetry Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div>
          <span>Lines: {sql ? lines.length : 0}</span>
          <span style={{ margin: '0 0.5rem' }}>|</span>
          <span>Chars: {sql.length}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Read-only AST inspection input</div>
      </div>
    </div>
  );
};
