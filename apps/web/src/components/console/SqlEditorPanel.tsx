import React, { useState } from 'react';
import { Copy, Trash, Check, CodeBlock } from '@phosphor-icons/react';

interface SqlEditorPanelProps {
  sql: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SqlEditorPanel: React.FC<SqlEditorPanelProps> = ({
  sql,
  onChange,
  disabled = false,
}) => {
  const [copied, setCopied] = useState(false);

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
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() =>
              handleInsertTemplate(
                'ALTER TABLE public.events\nADD COLUMN example integer NOT NULL DEFAULT 0;'
              )
            }
            disabled={disabled}
            className="btn btn-ghost"
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            title={
              disabled
                ? 'Editor is locked during analysis'
                : 'Load standard additive column migration template'
            }
            aria-label="Load example migration template"
          >
            Example Template
          </button>
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
            color: '#4b5563',
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
