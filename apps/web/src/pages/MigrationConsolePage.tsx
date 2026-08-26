import React, { useState } from 'react';
import { ConsoleHeader } from '../components/console/ConsoleHeader.js';
import { SqlEditorPanel } from '../components/console/SqlEditorPanel.js';
import { TargetConfigPanel } from '../components/console/TargetConfigPanel.js';
import { SessionStatusPanel } from '../components/console/SessionStatusPanel.js';
import { RiskPreviewPanel } from '../components/console/RiskPreviewPanel.js';
import { ActivityEvidencePanel } from '../components/console/ActivityEvidencePanel.js';
import { RehearsalProgressPanel } from '../components/console/RehearsalProgressPanel.js';
import { RehearsalEvidencePanel } from '../components/console/RehearsalEvidencePanel.js';
import { MigrationConsoleModal } from '../components/MigrationConsoleModal.js';
import {
  MigrationApiClient,
  type ClientApiErrorKind,
  type ApiSessionData,
} from '../services/migration-api.service.js';
import type { MigrationRehearsalEvidence } from '@orvexa/shared';
import { Play, Cube, Info, WarningCircle, XCircle, ShieldWarning } from '@phosphor-icons/react';

interface NoticeState {
  kind: ClientApiErrorKind;
  title: string;
  message: string;
}

export const MigrationConsolePage: React.FC = () => {
  const [sql, setSql] = useState<string>(
    'ALTER TABLE public.events\nADD COLUMN ui_rehearsal_marker integer NOT NULL DEFAULT 0;'
  );
  const [session, setSession] = useState<ApiSessionData | null>(null);
  const [rehearsalEvidence, setRehearsalEvidence] = useState<MigrationRehearsalEvidence | null>(
    null
  );
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [isRehearsing, setIsRehearsing] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [telemetryModalOpen, setTelemetryModalOpen] = useState<boolean>(false);

  // An active session is dirty if the user edits the SQL text away from the session's bound SQL
  const isSqlDirty = Boolean(
    session &&
    session.proposedMigration?.rawSql &&
    sql.trim() !== session.proposedMigration.rawSql.trim()
  );

  const currentStatus = session?.status || 'DRAFT';
  const effectiveStatus = isSqlDirty ? 'DRAFT' : currentStatus;
  const hasAnalysis = Boolean(!isSqlDirty && session?.analysisResult && session?.riskAssessment);
  const isSafeForSandbox = Boolean(
    !isSqlDirty &&
    session?.analysisResult?.isSafeForSandbox &&
    (!session.analysisResult.blockers || session.analysisResult.blockers.length === 0)
  );
  const hasBlockers = Boolean(
    !isSqlDirty &&
    session?.analysisResult &&
    (!session.analysisResult.isSafeForSandbox ||
      (session.analysisResult.blockers && session.analysisResult.blockers.length > 0))
  );

  const activeEvidence = isSqlDirty ? undefined : rehearsalEvidence || session?.rehearsalEvidence;

  const handleCreateAndAnalyze = async () => {
    if (!sql.trim() || isWorking || isRehearsing) return;
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
        setRehearsalEvidence(null);
        targetSessionId = createResult.data.sessionId;
      } else {
        targetSessionId = session.sessionId;
      }

      // Execute deterministic static AST risk analysis on the session
      const analyzeResult = await MigrationApiClient.analyzeSession(targetSessionId);

      if (analyzeResult.success && analyzeResult.data) {
        setSession(analyzeResult.data);
        if (analyzeResult.data.rehearsalEvidence) {
          setRehearsalEvidence(analyzeResult.data.rehearsalEvidence);
        }
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

  const handleStartRehearsal = async () => {
    if (!session || isWorking || isRehearsing || isSqlDirty) return;
    if (session.status !== 'SANDBOX_READY') return;

    setIsRehearsing(true);
    setNotice(null);

    // Optimistically update status to SANDBOX_RUNNING
    setSession((prev) => (prev ? { ...prev, status: 'SANDBOX_RUNNING' } : null));

    try {
      const rehearsalResult = await MigrationApiClient.runRehearsal(session.sessionId);

      if (rehearsalResult.success && rehearsalResult.data) {
        setSession(rehearsalResult.data.session);
        setRehearsalEvidence(rehearsalResult.data.session.rehearsalEvidence || null);
      } else {
        // Refresh session to capture updated SANDBOX_FAILED state
        const refreshed = await MigrationApiClient.getSession(session.sessionId);
        if (refreshed.success && refreshed.data) {
          setSession(refreshed.data);
          if (refreshed.data.rehearsalEvidence) {
            setRehearsalEvidence(refreshed.data.rehearsalEvidence);
          }
        } else {
          setSession((prev) => (prev ? { ...prev, status: 'SANDBOX_FAILED' } : null));
        }

        if (rehearsalResult.errorKind === 'API_MISSING') {
          setNotice({
            kind: 'API_MISSING',
            title: 'Engine Integration Notice',
            message: rehearsalResult.error || 'Backend REST rehearsal route is not mounted.',
          });
        } else if (rehearsalResult.errorKind === 'NETWORK_ERROR') {
          setNotice({
            kind: 'NETWORK_ERROR',
            title: 'Network Connection Error',
            message:
              rehearsalResult.error ||
              'Backend server is unreachable. Please verify server connection and try again.',
          });
        } else {
          setNotice({
            kind: 'API_ERROR',
            title: 'Rehearsal Failed',
            message: rehearsalResult.error || 'Rehearsal execution encountered a failure.',
          });
        }
      }
    } finally {
      setIsRehearsing(false);
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
              <SqlEditorPanel sql={sql} onChange={setSql} disabled={isWorking || isRehearsing} />

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
                    : effectiveStatus === 'SANDBOX_READY'
                      ? 'Deterministic AST evaluation complete. Ready for Daytona sandbox rehearsal.'
                      : effectiveStatus === 'SANDBOX_RUNNING'
                        ? 'Executing migration rehearsal in disposable PostgreSQL and Daytona sandbox...'
                        : effectiveStatus === 'SANDBOX_REHEARSAL_COMPLETED'
                          ? 'Rehearsal completed successfully. Zero target mutations verified.'
                          : effectiveStatus === 'SANDBOX_FAILED'
                            ? 'Rehearsal execution failed. Inspect evidence logs below.'
                            : hasAnalysis
                              ? 'Analysis complete.'
                              : 'Ready to inspect AST structure and evaluate table locks.'}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Analysis Trigger Button */}
                  <button
                    onClick={handleCreateAndAnalyze}
                    disabled={!sql.trim() || isWorking || isRehearsing}
                    className="btn btn-secondary"
                    id="analyze-migration-btn"
                    style={{
                      padding: '0.6rem 1.25rem',
                      fontSize: '0.875rem',
                      opacity: isWorking || isRehearsing ? 0.6 : 1,
                      cursor: isWorking || isRehearsing ? 'not-allowed' : 'pointer',
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

                  {/* Rehearsal CTA Button (Part 6) */}
                  {effectiveStatus === 'SANDBOX_READY' && isSafeForSandbox && (
                    <button
                      onClick={handleStartRehearsal}
                      disabled={isWorking || isRehearsing}
                      className="btn btn-primary"
                      id="start-rehearsal-btn"
                      style={{
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.875rem',
                        opacity: isWorking || isRehearsing ? 0.6 : 1,
                        cursor: isWorking || isRehearsing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Cube size={16} weight="fill" />
                      <span>
                        {isRehearsing ? 'Rehearsing in Sandbox...' : 'Start Sandbox Rehearsal'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Blocker Rehearsal Unavailable Banner (Part 6) */}
              {hasBlockers && (
                <div
                  style={{
                    padding: '0.875rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-card)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <ShieldWarning
                    size={18}
                    color="var(--status-error)"
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div>
                    <div
                      style={{
                        color: 'var(--status-error)',
                        fontWeight: 600,
                        marginBottom: '0.125rem',
                      }}
                    >
                      Rehearsal Unavailable
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Active migration blockers prevent safe sandbox execution. Resolve AST warnings
                      or destructive DDL statements to proceed.
                    </div>
                  </div>
                </div>
              )}

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

              {/* Rehearsal Progress Panel (Part 7) */}
              {(effectiveStatus === 'SANDBOX_RUNNING' ||
                effectiveStatus === 'SANDBOX_REHEARSAL_COMPLETED' ||
                effectiveStatus === 'SANDBOX_FAILED') && (
                <RehearsalProgressPanel
                  status={effectiveStatus}
                  durationMs={activeEvidence?.durationMs}
                  errorMessage={session?.lastErrorMessage || activeEvidence?.failureReason}
                />
              )}

              {/* Rehearsal Evidence Panel (Part 8 & 9) */}
              {activeEvidence && <RehearsalEvidencePanel evidence={activeEvidence} />}

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
                status={effectiveStatus}
                createdAt={session?.createdAt}
              />

              {/* Evidence & Activity Panel */}
              <ActivityEvidencePanel status={effectiveStatus} history={session?.history} />
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
