import React, { useState, useEffect } from 'react';
import { ConsoleHeader } from '../components/console/ConsoleHeader.js';
import { SqlEditorPanel } from '../components/console/SqlEditorPanel.js';
import { TargetConfigPanel } from '../components/console/TargetConfigPanel.js';
import { SessionStatusPanel } from '../components/console/SessionStatusPanel.js';
import { RiskPreviewPanel } from '../components/console/RiskPreviewPanel.js';
import { ActivityEvidencePanel } from '../components/console/ActivityEvidencePanel.js';
import { RehearsalProgressPanel } from '../components/console/RehearsalProgressPanel.js';
import { RehearsalEvidencePanel } from '../components/console/RehearsalEvidencePanel.js';
import { ApprovalGatePanel } from '../components/console/ApprovalGatePanel.js';
import { LiveExecutionPanel } from '../components/console/LiveExecutionPanel.js';
import { MigrationConsoleModal } from '../components/MigrationConsoleModal.js';
import {
  MigrationApiClient,
  type ClientApiErrorKind,
  type ApiSessionData,
} from '../services/migration-api.service.js';
import type { MigrationRehearsalEvidence } from '@orvexa/shared';
import { Play, Cube, Info, WarningCircle, XCircle, X } from '@phosphor-icons/react';
import {
  isMissingRelationError,
  isMissingColumnError,
  extractMissingColumnDetails,
} from '../utils/error-classification.js';

interface NoticeState {
  kind: ClientApiErrorKind;
  title: string;
  message: string;
}

export const MigrationConsolePage: React.FC = () => {
  const [sql, setSql] = useState<string>(
    'ALTER TABLE public.events\nADD COLUMN ui_approval_marker integer NOT NULL DEFAULT 0;'
  );
  const [session, setSession] = useState<ApiSessionData | null>(null);
  const [rehearsalEvidence, setRehearsalEvidence] = useState<MigrationRehearsalEvidence | null>(
    null
  );
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [isRehearsing, setIsRehearsing] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [telemetryModalOpen, setTelemetryModalOpen] = useState<boolean>(false);

  const activeSessionIdRef = React.useRef<string | null>(null);
  const isMountedRef = React.useRef<boolean>(true);
  const sessionCreationCountRef = React.useRef<number>(0);

  // Sync activeSessionIdRef with current session state
  useEffect(() => {
    activeSessionIdRef.current = session?.sessionId || null;
  }, [session?.sessionId]);

  // Hydrate active session on initial page mount from URL query param or localStorage
  useEffect(() => {
    isMountedRef.current = true;
    const initialCreationCount = sessionCreationCountRef.current;

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetSessionId =
      params.get('sessionId') ||
      params.get('session') ||
      localStorage.getItem('orvexa_active_session_id');

    if (targetSessionId) {
      MigrationApiClient.getSession(targetSessionId).then((res) => {
        // Guard against race conditions: if unmounted or user has already created/switched sessions, ignore stale response
        if (!isMountedRef.current) return;
        if (sessionCreationCountRef.current !== initialCreationCount) return;
        if (activeSessionIdRef.current !== null && activeSessionIdRef.current !== targetSessionId) {
          return;
        }

        if (res.success && res.data) {
          setSession(res.data);
          activeSessionIdRef.current = res.data.sessionId;
          if (res.data.proposedMigration?.rawSql) {
            setSql(res.data.proposedMigration.rawSql);
          }
          if (res.data.rehearsalEvidence) {
            setRehearsalEvidence(res.data.rehearsalEvidence);
          }
        }
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Persist current active session ID to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.sessionId) {
      localStorage.setItem('orvexa_active_session_id', session.sessionId);
    }
  }, [session?.sessionId]);

  // Canonical Target Identity for Scoping Applied SQLs (Finding #2)
  const targetDbName = (session?.target?.databaseName || 'schemasentry_test').toLowerCase().trim();
  const targetSchemaName = (session?.target?.schemaName || 'public').toLowerCase().trim();
  const activeTargetKey = `${targetDbName}:${targetSchemaName}`;

  const [appliedSqlStore, setAppliedSqlStore] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('orvexa_applied_sqls_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const activeAppliedSqls = appliedSqlStore[activeTargetKey] || [];

  const recordAppliedSql = (appliedSql: string, targetKey: string) => {
    if (!appliedSql || !targetKey) return;
    setAppliedSqlStore((prev) => {
      const existing = prev[targetKey] || [];
      const updatedList = Array.from(new Set([...existing, appliedSql.trim()]));
      const nextStore = { ...prev, [targetKey]: updatedList };
      try {
        localStorage.setItem('orvexa_applied_sqls_v2', JSON.stringify(nextStore));
      } catch {
        // ignore storage errors
      }
      return nextStore;
    });
  };

  // An active session is dirty if the user edits the SQL text away from the session's bound SQL
  const isSqlDirty = Boolean(
    session &&
    session.proposedMigration?.rawSql &&
    sql.trim() !== session.proposedMigration.rawSql.trim()
  );

  const isTerminalSession = Boolean(
    session &&
    (session.status === 'COMPLETED' ||
      session.status === 'REJECTED' ||
      session.status === 'EXECUTION_FAILED' ||
      session.status === 'VERIFICATION_FAILED')
  );

  const needsNewSession = !session || isSqlDirty || isTerminalSession;

  const currentStatus = session?.status || 'DRAFT';
  const effectiveStatus = isSqlDirty ? 'DRAFT' : currentStatus;
  const hasAnalysis = Boolean(!isSqlDirty && session?.analysisResult && session?.riskAssessment);
  const isSafeForSandbox = Boolean(
    !isSqlDirty &&
    session?.analysisResult?.isSafeForSandbox &&
    (!session?.analysisResult?.blockers || session.analysisResult.blockers.length === 0)
  );

  const activeEvidence = isSqlDirty ? undefined : rehearsalEvidence || session?.rehearsalEvidence;

  const handleSqlChange = (newSql: string) => {
    setSql(newSql);
    setNotice(null);
  };

  const handleCreateAndAnalyze = async () => {
    if (!sql.trim() || isWorking || isRehearsing || isApproving) return;
    sessionCreationCountRef.current += 1;
    setIsWorking(true);
    setNotice(null);

    try {
      let targetSessionId: string;

      // If SQL was modified, no session exists, or previous migration is terminal, create a new session bound to the current SQL
      if (needsNewSession) {
        const createResult = await MigrationApiClient.createSession({
          sql: sql.trim(),
          target: {
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
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Unexpected Client Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsWorking(false);
    }
  };

  const handleStartRehearsal = async () => {
    if (!session || isSqlDirty || isWorking || isRehearsing || isApproving) return;

    if (
      !session.analysisResult?.isSafeForSandbox ||
      (session.analysisResult.blockers && session.analysisResult.blockers.length > 0)
    ) {
      setNotice({
        kind: 'API_ERROR',
        title: 'Rehearsal Blocked',
        message: 'Cannot start sandbox rehearsal: Analysis found blocking conditions.',
      });
      return;
    }

    setIsRehearsing(true);
    setNotice(null);

    // Optimistically show execution in progress
    setSession((prev) => (prev ? { ...prev, status: 'SANDBOX_RUNNING' } : null));

    try {
      const rehearsalResult = await MigrationApiClient.runRehearsal(session.sessionId);

      if (rehearsalResult.success && rehearsalResult.data) {
        const responseData = rehearsalResult.data;
        const normalizedEvidence: MigrationRehearsalEvidence = {
          rehearsalId: responseData.rehearsalId,
          sessionId: responseData.sessionId,
          migrationId: responseData.migrationId || session.proposedMigration.migrationId,
          sandboxId: responseData.sandboxId || responseData.executionId || 'sandbox_local',
          executionId: responseData.executionId || responseData.sandboxId || 'exec_local',
          status: responseData.status,
          startedAt: responseData.startedAt,
          completedAt: responseData.completedAt,
          durationMs: responseData.durationMs,
          exitCode: responseData.exitCode,
          statementsAttempted: responseData.statementsAttempted,
          statementsSucceeded: responseData.statementsSucceeded,
          statementsFailed: responseData.statementsFailed,
          statementResults: [],
          preMigrationInspection: [],
          postMigrationInspection: [],
          rollbackStatus: 'DISCARDED',
          stdout: responseData.stdout,
          stderr: responseData.stderr,
          schemaDifferences: responseData.schemaDiff,
          affectedTables: [
            ...(responseData.schemaDiff?.tables?.added?.map((t) => t.tableName) || []),
            ...(responseData.schemaDiff?.tables?.removed?.map((t) => t.tableName) || []),
            ...(responseData.schemaDiff?.tables?.modified?.map((t) => t.name) || []),
          ],
          cleanupStatus: responseData.cleanupStatus,
          targetUntouched: responseData.targetUntouched,
          failureReason: responseData.failureReason,
        };

        setRehearsalEvidence(normalizedEvidence);

        if (responseData.session) {
          setSession(responseData.session);
        } else {
          // Re-fetch latest session state
          const refreshed = await MigrationApiClient.getSession(session.sessionId);
          if (refreshed.success && refreshed.data) {
            setSession(refreshed.data);
          }
        }
      } else {
        // Fetch current session state to ensure accurate error display
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
            message: rehearsalResult.error || 'Backend server is unreachable during rehearsal.',
          });
        } else {
          setNotice({
            kind: 'API_ERROR',
            title: 'Rehearsal Failed',
            message: rehearsalResult.error || 'Rehearsal execution failed.',
          });
        }
      }
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Rehearsal Client Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRehearsing(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!session || isSqlDirty || isWorking || isRehearsing || isApproving) return;

    setIsApproving(true);
    setNotice(null);

    try {
      const result = await MigrationApiClient.requestApproval(session.sessionId, 'Engineer');

      if (result.success && result.data) {
        if (result.data.session) {
          setSession(result.data.session as ApiSessionData);
        } else {
          const refreshed = await MigrationApiClient.getSession(session.sessionId);
          if (refreshed.success && refreshed.data) {
            setSession(refreshed.data);
          }
        }
      } else {
        setNotice({
          kind: result.errorKind || 'API_ERROR',
          title: 'Approval Request Error',
          message: result.error || 'Failed to request human approval.',
        });
      }
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Approval Request Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleApproveMigration = async (approver: string, comment?: string) => {
    if (!session || isSqlDirty || isWorking || isRehearsing || isApproving) return;

    setIsApproving(true);
    setNotice(null);

    try {
      const result = await MigrationApiClient.approveMigration(
        session.sessionId,
        approver,
        comment,
        session.approvalRequest?.fingerprint
      );

      if (result.success && result.data) {
        if (result.data.session) {
          setSession(result.data.session as ApiSessionData);
        } else {
          const refreshed = await MigrationApiClient.getSession(session.sessionId);
          if (refreshed.success && refreshed.data) {
            setSession(refreshed.data);
          }
        }
      } else {
        setNotice({
          kind: result.errorKind || 'API_ERROR',
          title: 'Approval Error',
          message: result.error || 'Failed to approve migration.',
        });
      }
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Approval Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectMigration = async (approver: string, rejectionReason: string) => {
    if (!session || isSqlDirty || isWorking || isRehearsing || isApproving) return;

    setIsApproving(true);
    setNotice(null);

    try {
      const result = await MigrationApiClient.rejectMigration(
        session.sessionId,
        approver,
        rejectionReason,
        session.approvalRequest?.fingerprint
      );

      if (result.success && result.data) {
        if (result.data.session) {
          setSession(result.data.session as ApiSessionData);
        } else {
          const refreshed = await MigrationApiClient.getSession(session.sessionId);
          if (refreshed.success && refreshed.data) {
            setSession(refreshed.data);
          }
        }
      } else {
        setNotice({
          kind: result.errorKind || 'API_ERROR',
          title: 'Rejection Error',
          message: result.error || 'Failed to reject migration.',
        });
      }
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Rejection Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleExecuteMigration = async (actor?: string) => {
    if (!session || isSqlDirty || isWorking || isRehearsing || isApproving || isExecuting) return;
    if (session.status !== 'APPROVED') return;

    setIsExecuting(true);
    setNotice(null);

    // Optimistically show execution in progress
    setSession((prev) => (prev ? { ...prev, status: 'EXECUTING' } : null));

    try {
      const result = await MigrationApiClient.executeMigration(session.sessionId, actor);

      if (result.success && result.data) {
        // Finding #1: Only record as applied if finalStatus is strictly COMPLETED
        if (result.data.finalStatus === 'COMPLETED') {
          const appliedText = session.proposedMigration?.rawSql || sql;
          if (appliedText) {
            recordAppliedSql(appliedText, activeTargetKey);
          }
        }
        if (result.data.session) {
          setSession(result.data.session as ApiSessionData);
        } else {
          const refreshed = await MigrationApiClient.getSession(session.sessionId);
          if (refreshed.success && refreshed.data) {
            setSession(refreshed.data);
          }
        }
      } else {
        const refreshed = await MigrationApiClient.getSession(session.sessionId);
        if (refreshed.success && refreshed.data) {
          setSession(refreshed.data);
        } else {
          setSession((prev) => (prev ? { ...prev, status: 'EXECUTION_FAILED' } : null));
        }

        setNotice({
          kind: result.errorKind || 'API_ERROR',
          title: 'Execution Error',
          message: result.error || 'Failed to execute migration on target database.',
        });
      }
    } catch (err) {
      setNotice({
        kind: 'NETWORK_ERROR',
        title: 'Execution Client Error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const currentErrorMsg =
    activeEvidence?.failureReason || session?.lastErrorMessage || notice?.message || '';

  const isMissingRelation = isMissingRelationError(currentErrorMsg);
  const isMissingColumn = isMissingColumnError(currentErrorMsg);
  const missingColDetails = extractMissingColumnDetails(currentErrorMsg);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Header */}
      <ConsoleHeader onOpenTelemetryModal={() => setTelemetryModalOpen(true)} />

      {/* Main Console Workspace */}
      <main
        style={{
          flex: 1,
          padding: '1.5rem',
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main 2-Column Responsive Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Primary Workflow Stream (Left Column) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* SQL Migration Editor */}
              <SqlEditorPanel
                sql={sql}
                onChange={handleSqlChange}
                appliedSqls={activeAppliedSqls}
              />

              {/* Action Controls & Engine Readiness */}
              <div
                className="panel"
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {isSqlDirty
                    ? 'SQL modified. Click to create a new session for updated script.'
                    : isTerminalSession
                      ? 'Previous migration completed. Click to create a new session for this script.'
                      : effectiveStatus === 'SANDBOX_READY'
                        ? 'Deterministic AST evaluation complete. Ready for Daytona sandbox rehearsal.'
                        : effectiveStatus === 'SANDBOX_RUNNING'
                          ? 'Executing migration rehearsal in disposable PostgreSQL and Daytona sandbox...'
                          : effectiveStatus === 'SANDBOX_REHEARSAL_COMPLETED'
                            ? 'Rehearsal completed successfully. Request human approval to proceed.'
                            : effectiveStatus === 'AWAITING_APPROVAL'
                              ? 'Human review required. Inspect rehearsal evidence and record decision.'
                              : effectiveStatus === 'APPROVED'
                                ? 'Human approval recorded and cryptographically sealed. Ready for controlled live target execution.'
                                : effectiveStatus === 'EXECUTING'
                                  ? 'Executing approved migration statements against target PostgreSQL database...'
                                  : effectiveStatus === 'VERIFYING'
                                    ? 'Running automated post-execution verification probes on target database...'
                                    : effectiveStatus === 'COMPLETED'
                                      ? 'Migration executed and verified successfully. All verification probes passed.'
                                      : effectiveStatus === 'EXECUTION_FAILED'
                                        ? 'Target database migration execution failed. Inspect execution logs below.'
                                        : effectiveStatus === 'VERIFICATION_FAILED'
                                          ? 'Post-execution verification failed. Target schema or health checks did not pass.'
                                          : effectiveStatus === 'REJECTED'
                                            ? 'Migration rejected by approver.'
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
                    disabled={
                      !sql.trim() || isWorking || isRehearsing || isApproving || isExecuting
                    }
                    className="btn btn-secondary"
                    id="analyze-migration-btn"
                    style={{
                      padding: '0.6rem 1.25rem',
                      fontSize: '0.875rem',
                      opacity: isWorking || isRehearsing || isApproving || isExecuting ? 0.6 : 1,
                      cursor:
                        isWorking || isRehearsing || isApproving || isExecuting
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    <Play size={16} weight="fill" />
                    <span>
                      {isWorking
                        ? 'Analyzing AST...'
                        : needsNewSession
                          ? 'Create & Analyze Migration'
                          : 'Re-Analyze Migration'}
                    </span>
                  </button>

                  {/* Rehearsal CTA Button */}
                  {effectiveStatus === 'SANDBOX_READY' && isSafeForSandbox && (
                    <button
                      onClick={handleStartRehearsal}
                      disabled={isWorking || isRehearsing || isApproving}
                      className="btn btn-primary"
                      id="start-rehearsal-btn"
                      style={{
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.875rem',
                        opacity: isWorking || isRehearsing || isApproving ? 0.6 : 1,
                        cursor:
                          isWorking || isRehearsing || isApproving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Cube size={16} weight="fill" />
                      <span>
                        {isRehearsing ? 'Running Rehearsal...' : 'Start Sandbox Rehearsal'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Risk Preview Panel (Part 3 & 4) */}
              <RiskPreviewPanel
                analysisResult={isSqlDirty ? undefined : session?.analysisResult}
                riskAssessment={isSqlDirty ? undefined : session?.riskAssessment}
                sandboxEligibility={isSqlDirty ? undefined : session?.sandboxEligibility}
              />

              {/* Rehearsal Progress Timeline Panel (Part 5 & 6) */}
              <RehearsalProgressPanel
                status={effectiveStatus}
                durationMs={activeEvidence?.durationMs}
                errorMessage={activeEvidence?.failureReason || session?.lastErrorMessage}
              />

              {/* Rehearsal Evidence & Diff Panel (Part 5 & 6) */}
              {activeEvidence && !isSqlDirty && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <RehearsalEvidencePanel evidence={activeEvidence} />

                  {/* Direct Request Approval CTA Button */}
                  {effectiveStatus === 'SANDBOX_REHEARSAL_COMPLETED' && (
                    <div
                      className="panel"
                      style={{
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        border: '1.5px solid var(--accent)',
                        backgroundColor: 'var(--accent-subtle)',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Rehearsal Successful & Verified Isolated
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Target database remained untouched. Proceed to generate cryptographic
                          approval seal.
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestApproval()}
                        disabled={isApproving || isWorking || isRehearsing}
                        className="btn btn-primary"
                        style={{
                          padding: '0.65rem 1.5rem',
                          fontSize: '0.875rem',
                          fontWeight: 700,
                        }}
                      >
                        Request Human Approval
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* API Notice / Diagnostic Status */}
              {notice && (
                <div
                  id="console-notice-banner"
                  style={{
                    padding: '0.875rem 1rem',
                    backgroundColor:
                      notice.kind === 'API_MISSING'
                        ? 'rgba(59, 130, 246, 0.08)'
                        : notice.kind === 'NETWORK_ERROR'
                          ? 'rgba(234, 179, 8, 0.08)'
                          : 'rgba(244, 63, 94, 0.08)',
                    border: `1px solid ${
                      notice.kind === 'API_MISSING'
                        ? 'rgba(59, 130, 246, 0.3)'
                        : notice.kind === 'NETWORK_ERROR'
                          ? 'rgba(234, 179, 8, 0.3)'
                          : 'rgba(244, 63, 94, 0.3)'
                    }`,
                    borderRadius: 'var(--radius-card)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
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

                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                    title="Dismiss notice"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>
              )}

              {/* Missing Target Table Help Banner (Finding #6 & #7) */}
              {(effectiveStatus === 'SANDBOX_FAILED' ||
                activeEvidence?.status === 'FAILED' ||
                Boolean(notice)) &&
                isMissingRelation && (
                  <div
                    id="missing-table-help-banner"
                    style={{
                      padding: '1rem 1.25rem',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      borderRadius: 'var(--radius-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        maxWidth: '680px',
                      }}
                    >
                      <WarningCircle
                        size={22}
                        color="var(--status-warning)"
                        weight="fill"
                        style={{ flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'var(--status-warning)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Target Table Missing on Connected Database
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          Your connected PostgreSQL database does not have this table yet. To
                          execute ALTER TABLE, initialize the table first using{' '}
                          <strong>Step 1: Baseline Table</strong>.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSql(
                          `CREATE TABLE IF NOT EXISTS public.events (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  organization_id uuid,\n  user_id uuid,\n  event_type text NOT NULL,\n  payload jsonb DEFAULT '{}'::jsonb,\n  created_at timestamptz NOT NULL DEFAULT now()\n);`
                        );
                        setNotice(null);
                      }}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.8125rem',
                        padding: '0.45rem 0.875rem',
                        border: '1px solid rgba(234, 179, 8, 0.5)',
                        color: 'var(--status-warning)',
                      }}
                    >
                      Load Step 1: Create Table SQL
                    </button>
                  </div>
                )}

              {/* Missing Target Column Help Banner (Finding #7) */}
              {(effectiveStatus === 'SANDBOX_FAILED' ||
                activeEvidence?.status === 'FAILED' ||
                Boolean(notice)) &&
                isMissingColumn && (
                  <div
                    id="missing-column-help-banner"
                    style={{
                      padding: '1rem 1.25rem',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      borderRadius: 'var(--radius-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        maxWidth: '680px',
                      }}
                    >
                      <WarningCircle
                        size={22}
                        color="var(--status-warning)"
                        weight="fill"
                        style={{ flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'var(--status-warning)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Target Column Missing on Database Table
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          Column{' '}
                          <code
                            style={{
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: 'rgba(0,0,0,0.1)',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '3px',
                            }}
                          >
                            {missingColDetails.columnName || 'referenced column'}
                          </code>{' '}
                          does not exist on the target table. Please verify column definitions or
                          run a prerequisite additive migration first.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Approval Gate Panel (Part 7 & 8) */}
              {session &&
                !isSqlDirty &&
                (effectiveStatus === 'AWAITING_APPROVAL' ||
                  effectiveStatus === 'APPROVED' ||
                  effectiveStatus === 'REJECTED') && (
                  <ApprovalGatePanel
                    session={session}
                    isSubmitting={isApproving}
                    onApprove={handleApproveMigration}
                    onReject={handleRejectMigration}
                  />
                )}

              {/* Live Execution & Verification Panel (Phase 2.5) */}
              {session &&
                !isSqlDirty &&
                (effectiveStatus === 'APPROVED' ||
                  effectiveStatus === 'EXECUTING' ||
                  effectiveStatus === 'VERIFYING' ||
                  effectiveStatus === 'COMPLETED' ||
                  effectiveStatus === 'EXECUTION_FAILED' ||
                  effectiveStatus === 'VERIFICATION_FAILED') && (
                  <LiveExecutionPanel
                    session={session}
                    isExecuting={isExecuting}
                    onExecute={handleExecuteMigration}
                  />
                )}

              {/* Rehearsal Progress Panel */}
              {(effectiveStatus === 'SANDBOX_RUNNING' ||
                effectiveStatus === 'SANDBOX_REHEARSAL_COMPLETED' ||
                effectiveStatus === 'SANDBOX_FAILED') && (
                <RehearsalProgressPanel
                  status={effectiveStatus}
                  durationMs={activeEvidence?.durationMs}
                  errorMessage={session?.lastErrorMessage || activeEvidence?.failureReason}
                />
              )}

              {/* Rehearsal Evidence Panel */}
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
