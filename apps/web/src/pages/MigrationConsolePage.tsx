import React, { useState } from 'react';
import { ConsoleHeader } from '../components/console/ConsoleHeader.js';
import { SqlEditorPanel } from '../components/console/SqlEditorPanel.js';
import { TargetConfigPanel } from '../components/console/TargetConfigPanel.js';
import { SessionStatusPanel } from '../components/console/SessionStatusPanel.js';
import { RiskPreviewPanel } from '../components/console/RiskPreviewPanel.js';
import { ActivityEvidencePanel } from '../components/console/ActivityEvidencePanel.js';
import { MigrationConsoleModal } from '../components/MigrationConsoleModal.js';
import {
  MigrationApiClient,
  type ClientApiErrorKind,
  type ApiSessionData,
} from '../services/migration-api.service.js';
import { Play, Info, WarningCircle, XCircle } from '@phosphor-icons/react';

interface NoticeState {
  kind: ClientApiErrorKind;
  title: string;
  message: string;
}

export const MigrationConsolePage: React.FC = () => {
  const [sql, setSql] = useState<string>(
    'ALTER TABLE public.events\nADD COLUMN example integer NOT NULL DEFAULT 0;'
  );
  const [session, setSession] = useState<ApiSessionData | null>(null);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [telemetryModalOpen, setTelemetryModalOpen] = useState<boolean>(false);

  // An active session is dirty if the user edits the SQL text away from the session's bound SQL
  const isSqlDirty = Boolean(
    session &&
    session.proposedMigration?.rawSql &&
    sql.trim() !== session.proposedMigration.rawSql.trim()
  );

  const handleCreateAndAnalyze = async () => {
    if (!sql.trim() || isWorking) return;
    setIsWorking(true);
    setNotice(null);

    try {
      let targetSessionId: string;

      // If SQL was modified or no session exists, create a new session bound to the current SQL
      if (!session || isSqlDirty) {
        const createResult = await MigrationApiClient.createSession({
          sql: sql.trim(),
          target: {
            databaseName: 'orvexa_db',
            schemaName: 'public',
            version: 'PostgreSQL 16',
          },
          name: 'console_migration',
        });

        if (!createResult.success || !createResult.data) {
          if (createResult.errorKind === 'API_MISSING') {
            setNotice({
              kind: 'API_MISSING',
              title: 'Engine Integration Notice',
              message:
                createResult.error ||
                'Backend REST session route is not yet mounted. Core engine is available via MCP.',
            });
          } else if (createResult.errorKind === 'NETWORK_ERROR') {
            setNotice({
              kind: 'NETWORK_ERROR',
              title: 'Network Connection Error',
              message:
                createResult.error ||
                'Backend server is unreachable. Please verify server connection and try again.',
            });
          } else {
            setNotice({
              kind: 'API_ERROR',
              title: 'Backend Server Error',
              message: createResult.error || 'Failed to create migration session.',
            });
          }
          return;
        }

        // Immediately persist the created session in UI state to prevent orphan sessions
        setSession(createResult.data);
        targetSessionId = createResult.data.sessionId;
      } else {
        targetSessionId = session.sessionId;
      }

      // Execute deterministic static AST risk analysis on the session
      const analyzeResult = await MigrationApiClient.analyzeSession(targetSessionId);

      if (analyzeResult.success && analyzeResult.data) {
        setSession(analyzeResult.data);
      } else {
        // Keep the created session visible and transition status to ANALYSIS_FAILED
        setSession((prev) => (prev ? { ...prev, status: 'ANALYSIS_FAILED' } : null));

        if (analyzeResult.errorKind === 'API_MISSING') {
          setNotice({
            kind: 'API_MISSING',
            title: 'Engine Integration Notice',
            message:
              analyzeResult.error ||
              'Backend REST analysis route is not mounted. Core AST analysis engine is available via MCP.',
          });
        } else if (analyzeResult.errorKind === 'NETWORK_ERROR') {
          setNotice({
            kind: 'NETWORK_ERROR',
            title: 'Network Connection Error',
            message:
              analyzeResult.error ||
              'Backend server is unreachable. Please verify server connection and try again.',
          });
        } else {
          setNotice({
            kind: 'API_ERROR',
            title: 'Analysis Error',
            message: analyzeResult.error || 'Server responded with an unexpected error.',
          });
        }
      }
    } finally {
      setIsWorking(false);
    }
  };

  const currentStatus = session?.status || 'DRAFT';
  const hasAnalysis = Boolean(!isSqlDirty && session?.analysisResult && session?.riskAssessment);

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
                <span
                  className={`badge ${
                    !session ? 'badge-neutral' : isSqlDirty ? 'badge-warning' : 'badge-success'
                  }`}
                  style={{ fontSize: '0.75rem' }}
                >
                  <span className="status-indicator" />
                  <span>
                    {!session
                      ? 'Session: Local Draft'
                      : isSqlDirty
                        ? 'Session: Draft Modified'
                        : `Session: ${session.sessionId.slice(0, 18)}`}
                  </span>
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
              <SqlEditorPanel sql={sql} onChange={setSql} disabled={isWorking} />

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
                  {isSqlDirty
                    ? 'SQL modified. Click to create a new session for updated script.'
                    : hasAnalysis
                      ? 'Deterministic AST evaluation complete. Ready for sandbox rehearsal.'
                      : 'Ready to inspect AST structure and evaluate table locks'}
                </div>

                <button
                  onClick={handleCreateAndAnalyze}
                  disabled={!sql.trim() || isWorking}
                  className="btn btn-primary"
                  id="analyze-migration-btn"
                  style={{
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.875rem',
                    opacity: isWorking ? 0.6 : 1,
                    cursor: isWorking ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Play size={16} weight="fill" />
                  <span>
                    {isWorking
                      ? 'Analyzing AST...'
                      : !session || isSqlDirty
                        ? 'Create & Analyze Migration'
                        : 'Re-Analyze Migration'}
                  </span>
                </button>
              </div>

              {/* API Notice / Diagnostic Status */}
              {notice && (
                <div
                  style={{
                    padding: '0.875rem 1rem',
                    backgroundColor:
                      notice.kind === 'API_MISSING'
                        ? 'rgba(34, 211, 238, 0.05)'
                        : notice.kind === 'NETWORK_ERROR'
                          ? 'rgba(245, 158, 11, 0.05)'
                          : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${
                      notice.kind === 'API_MISSING'
                        ? 'var(--accent-border)'
                        : notice.kind === 'NETWORK_ERROR'
                          ? 'rgba(245, 158, 11, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'
                    }`,
                    borderRadius: 'var(--radius-card)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                  }}
                >
                  {notice.kind === 'API_MISSING' ? (
                    <Info
                      size={18}
                      color="var(--accent)"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                  ) : notice.kind === 'NETWORK_ERROR' ? (
                    <WarningCircle
                      size={18}
                      color="var(--status-warning)"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                  ) : (
                    <XCircle
                      size={18}
                      color="var(--status-error)"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        color:
                          notice.kind === 'API_MISSING'
                            ? 'var(--accent)'
                            : notice.kind === 'NETWORK_ERROR'
                              ? 'var(--status-warning)'
                              : 'var(--status-error)',
                        fontWeight: 600,
                        marginBottom: '0.125rem',
                      }}
                    >
                      {notice.title}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{notice.message}</div>
                  </div>
                </div>
              )}

              {/* Risk Preview Panel */}
              <RiskPreviewPanel
                analysisResult={!isSqlDirty ? session?.analysisResult : undefined}
                riskAssessment={!isSqlDirty ? session?.riskAssessment : undefined}
                sandboxEligibility={!isSqlDirty ? session?.sandboxEligibility : undefined}
              />
            </div>

            {/* Secondary Controls & Sidebar (Right Column) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Target Database Panel */}
              <TargetConfigPanel
                targetDatabase={session?.target?.databaseName}
                targetSchema={session?.target?.schemaName}
                postgresVersion={session?.target?.version}
                connectionStatus={session ? 'READY' : 'NOT_CONFIGURED'}
              />

              {/* Session Status Panel */}
              <SessionStatusPanel
                sessionId={session?.sessionId}
                status={isSqlDirty ? 'DRAFT' : currentStatus}
                createdAt={session?.createdAt}
              />

              {/* Evidence & Activity Panel */}
              <ActivityEvidencePanel
                status={isSqlDirty ? 'DRAFT' : currentStatus}
                history={session?.history}
              />
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
