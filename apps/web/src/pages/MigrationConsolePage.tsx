import React, { useState } from 'react';
import { ConsoleHeader } from '../components/console/ConsoleHeader.js';
import { SqlEditorPanel } from '../components/console/SqlEditorPanel.js';
import { TargetConfigPanel } from '../components/console/TargetConfigPanel.js';
import { SessionStatusPanel } from '../components/console/SessionStatusPanel.js';
import { RiskPreviewPanel } from '../components/console/RiskPreviewPanel.js';
import { ActivityEvidencePanel } from '../components/console/ActivityEvidencePanel.js';
import { MigrationConsoleModal } from '../components/MigrationConsoleModal.js';
import { MigrationApiClient } from '../services/migration-api.service.js';
import { Play, Info } from '@phosphor-icons/react';
import type { MigrationSessionStatus } from '@orvexa/shared';

export const MigrationConsolePage: React.FC = () => {
  const [sql, setSql] = useState<string>(
    'ALTER TABLE public.events\nADD COLUMN example integer NOT NULL DEFAULT 0;'
  );
  const [sessionStatus] = useState<MigrationSessionStatus>('DRAFT');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [telemetryModalOpen, setTelemetryModalOpen] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!sql.trim()) return;
    setIsAnalyzing(true);
    setApiNotice(null);

    // Call API client boundary
    const result = await MigrationApiClient.submitAnalysis({ sql });
    setIsAnalyzing(false);

    if (result.isApiMissing) {
      setApiNotice(
        'Backend analysis REST route is not yet wired to Express in this phase. The core AST analyzer is implemented in TypeScript and registered via the Orvexa MCP server.'
      );
    } else if (!result.success && result.error) {
      setApiNotice(result.error);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      {/* Console Navigation Bar */}
      <ConsoleHeader onOpenTelemetryModal={() => setTelemetryModalOpen(true)} />

      {/* Main Console Container */}
      <main style={{ flex: 1, padding: '2rem 0 4rem' }}>
        <div className="app-container">
          {/* Top Session Title Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  marginBottom: '0.375rem',
                }}
              >
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                  Migration Studio
                </h1>
                <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                  Session: DRAFT
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Draft, inspect, and evaluate PostgreSQL schema migrations with deterministic proof.
              </p>
            </div>
          </div>

          {/* Console Grid Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: '1.5rem',
              alignItems: 'start',
            }}
            className="console-grid"
          >
            {/* Primary Workspace (Left Column) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* SQL Input Editor */}
              <SqlEditorPanel sql={sql} onChange={setSql} disabled={isAnalyzing} />

              {/* Action Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Ready to inspect AST structure and evaluate table locks
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!sql.trim() || isAnalyzing}
                  className="btn btn-primary"
                  id="analyze-migration-btn"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
                >
                  <Play size={16} weight="fill" />
                  <span>{isAnalyzing ? 'Analyzing AST...' : 'Analyze Migration'}</span>
                </button>
              </div>

              {/* API Integration Boundary Notice (if triggered) */}
              {apiNotice && (
                <div
                  style={{
                    padding: '0.875rem 1rem',
                    backgroundColor: 'rgba(34, 211, 238, 0.05)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: 'var(--radius-card)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                  }}
                >
                  <Info
                    size={18}
                    color="var(--accent)"
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div>
                    <div
                      style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.125rem' }}
                    >
                      Engine Integration Notice
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{apiNotice}</div>
                  </div>
                </div>
              )}

              {/* Risk Preview Panel */}
              <RiskPreviewPanel hasAnalysis={false} />
            </div>

            {/* Secondary Controls & Sidebar (Right Column) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Target Database Panel */}
              <TargetConfigPanel />

              {/* Session Status Panel */}
              <SessionStatusPanel status={sessionStatus} />

              {/* Evidence & Activity Panel */}
              <ActivityEvidencePanel status={sessionStatus} />
            </div>
          </div>
        </div>
      </main>

      {/* Diagnostics Modal */}
      <MigrationConsoleModal
        isOpen={telemetryModalOpen}
        onClose={() => setTelemetryModalOpen(false)}
      />
    </div>
  );
};
