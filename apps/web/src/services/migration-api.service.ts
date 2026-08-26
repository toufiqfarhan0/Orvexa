import type {
  HealthCheckResponse,
  MigrationSessionStatus,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  SandboxRehearsalResult,
  MigrationRehearsalEvidence,
  SchemaDiffResult,
  ApprovalRequest,
  ApprovalDecision,
  SanitizedApprovalRequestResponse,
  SanitizedApprovalDecisionResponse,
  ExecutionResult,
  VerificationResult,
  SanitizedLiveExecutionResponse,
} from '@orvexa/shared';

export interface CreateSessionRequest {
  sql: string;
  target?: {
    databaseName?: string;
    schemaName?: string;
    version?: string;
  };
  name?: string;
}

export interface ApiSessionData {
  sessionId: string;
  status: MigrationSessionStatus;
  migrationId: string;
  target: {
    engine: string;
    version: string;
    databaseName: string;
    schemaName: string;
  };
  proposedMigration: {
    migrationId: string;
    name: string;
    rawSql: string;
  };
  analysisResult?: MigrationAnalysisResult;
  riskAssessment?: MigrationRiskAssessment;
  sandboxEligibility?: {
    eligible: boolean;
    requiresSandbox: boolean;
    blockersCount: number;
    warningsCount: number;
  };
  sandboxResult?: SandboxRehearsalResult;
  rehearsalEvidence?: MigrationRehearsalEvidence;
  lastErrorMessage?: string;
  approvalRequest?: ApprovalRequest;
  approvalDecision?: ApprovalDecision;
  executionResult?: ExecutionResult;
  verificationResult?: VerificationResult;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    fromStatus: string | null;
    toStatus: string;
    timestamp: string;
    reason?: string;
    actor?: string;
  }>;
}

export interface ApiRehearsalResponse {
  sessionId: string;
  migrationId: string;
  rehearsalId: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  executionId?: string;
  sandboxId?: string;
  exitCode: number;
  statementsAttempted: number;
  statementsSucceeded: number;
  statementsFailed: number;
  stdout: string;
  stderr: string;
  schemaDiff: SchemaDiffResult;
  preMigrationSnapshot: Array<{ tableName: string; columnCount: number }>;
  postMigrationSnapshot: Array<{ tableName: string; columnCount: number }>;
  cleanupStatus: 'COMPLETED' | 'FAILED';
  targetUntouched: boolean;
  failureReason?: string;
  session: ApiSessionData;
}

export type ApiApprovalRequestResponse = SanitizedApprovalRequestResponse;
export type ApiApprovalDecisionResponse = SanitizedApprovalDecisionResponse;

export type ClientApiErrorKind = 'API_MISSING' | 'API_ERROR' | 'NETWORK_ERROR';

export interface ClientApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorKind?: ClientApiErrorKind;
  isApiMissing?: boolean;
}

/**
 * Safely parses JSON response from fetch, accurately distinguishing
 * JSON parse errors, structured domain errors (e.g. SESSION_NOT_FOUND),
 * and missing endpoints (404 without structured JSON).
 */
async function parseJsonResponse<T>(
  res: Response,
  endpointDescription: string
): Promise<ClientApiResult<T>> {
  const contentType = res.headers?.get ? res.headers.get('content-type') : null;
  const isHtml = contentType?.includes('text/html');

  if (res.status === 404 && isHtml) {
    return {
      success: false,
      isApiMissing: true,
      errorKind: 'API_MISSING',
      error: `Endpoint not found (404): ${endpointDescription} is not yet available on the backend server.`,
    };
  }

  let body: {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  };

  try {
    let parsedRaw: unknown;
    if (typeof res.text === 'function') {
      const text = await res.text();
      if (!text.trim()) {
        return {
          success: false,
          isApiMissing: false,
          errorKind: 'API_ERROR',
          error: `Empty response received from ${endpointDescription} (HTTP ${res.status}).`,
        };
      }
      parsedRaw = JSON.parse(text);
    } else if (typeof res.json === 'function') {
      parsedRaw = await res.json();
    } else {
      throw new Error('Response object does not support text() or json()');
    }

    if (parsedRaw === null || typeof parsedRaw !== 'object' || Array.isArray(parsedRaw)) {
      return {
        success: false,
        isApiMissing: false,
        errorKind: 'API_ERROR',
        error: `Malformed response from ${endpointDescription} (HTTP ${res.status}): Expected structured JSON object.`,
      };
    }

    body = parsedRaw as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string; details?: unknown };
    };
  } catch (parseErr) {
    if (res.status === 404) {
      return {
        success: false,
        isApiMissing: true,
        errorKind: 'API_MISSING',
        error: `Endpoint not found (404): ${endpointDescription} is not yet available on the backend server.`,
      };
    }
    return {
      success: false,
      isApiMissing: false,
      errorKind: 'API_ERROR',
      error: `Invalid JSON response returned by ${endpointDescription} (HTTP ${res.status}): ${
        parseErr instanceof Error ? parseErr.message : String(parseErr)
      }`,
    };
  }

  if (!res.ok || !body.success) {
    const errorMsg =
      body.error?.message ||
      `Request failed: HTTP ${res.status} ${res.statusText || 'Error'} from ${endpointDescription}`;
    return {
      success: false,
      isApiMissing: false,
      errorKind: 'API_ERROR',
      error: errorMsg,
      data: body.data,
    };
  }

  return {
    success: true,
    data: body.data,
  };
}

/**
 * Client for Orvexa REST API backend endpoints with comprehensive error classification.
 */
export class MigrationApiClient {
  /**
   * Health check to probe server readiness.
   */
  static async checkHealth(): Promise<ClientApiResult<HealthCheckResponse>> {
    let res: Response;
    try {
      res = await fetch('/api/health');
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<HealthCheckResponse>(res, 'Health check endpoint (/api/health)');
  }

  /**
   * Creates a new migration session.
   */
  static async createSession(req: CreateSessionRequest): Promise<ClientApiResult<ApiSessionData>> {
    let res: Response;
    try {
      res = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiSessionData>(
      res,
      'Session creation endpoint (/api/migrations)'
    );
  }

  /**
   * Triggers deterministic AST risk analysis on an existing session.
   */
  static async analyzeSession(sessionId: string): Promise<ClientApiResult<ApiSessionData>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiSessionData>(
      res,
      `Analysis endpoint for session '${sessionId}'`
    );
  }

  /**
   * Triggers real isolated migration rehearsal workflow inside disposable PostgreSQL & Daytona sandbox.
   */
  static async runRehearsal(
    sessionId: string,
    options?: Record<string, unknown>
  ): Promise<ClientApiResult<ApiRehearsalResponse>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/rehearsal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiRehearsalResponse>(
      res,
      `Rehearsal endpoint for session '${sessionId}'`
    );
  }

  /**
   * Submits a completed migration rehearsal for human review and approval.
   */
  static async requestApproval(
    sessionId: string,
    actor?: string,
    comment?: string
  ): Promise<ClientApiResult<ApiApprovalRequestResponse>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor, comment }),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiApprovalRequestResponse>(
      res,
      `Approval request endpoint for session '${sessionId}'`
    );
  }

  /**
   * Records an explicit human APPROVE decision.
   */
  static async approveMigration(
    sessionId: string,
    approver: string,
    comment?: string,
    fingerprint?: string
  ): Promise<ClientApiResult<ApiApprovalDecisionResponse>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver, comment, fingerprint }),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiApprovalDecisionResponse>(
      res,
      `Approve endpoint for session '${sessionId}'`
    );
  }

  /**
   * Records an explicit human REJECT decision.
   */
  static async rejectMigration(
    sessionId: string,
    approver: string,
    rejectionReason: string,
    fingerprint?: string
  ): Promise<ClientApiResult<ApiApprovalDecisionResponse>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver, rejectionReason, fingerprint }),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiApprovalDecisionResponse>(
      res,
      `Reject endpoint for session '${sessionId}'`
    );
  }

  /**
   * Executes an approved migration against the target database and runs post-execution verification probes.
   */
  static async executeMigration(
    sessionId: string,
    actor?: string,
    timeoutMs?: number,
    confirmExecution: boolean = true
  ): Promise<ClientApiResult<SanitizedLiveExecutionResponse>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor: actor?.trim() || undefined,
          timeoutMs: timeoutMs || undefined,
          confirmExecution,
        }),
      });
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<SanitizedLiveExecutionResponse>(
      res,
      `Execute endpoint for session '${sessionId}'`
    );
  }

  /**
   * Retrieves current session state and evidence.
   */
  static async getSession(sessionId: string): Promise<ClientApiResult<ApiSessionData>> {
    let res: Response;
    try {
      res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}`);
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }

    return await parseJsonResponse<ApiSessionData>(res, `Session endpoint for '${sessionId}'`);
  }

  /**
   * High-level workflow: Creates a session and executes deterministic AST analysis.
   */
  static async createAndAnalyze(
    req: CreateSessionRequest
  ): Promise<ClientApiResult<ApiSessionData>> {
    const createResult = await this.createSession(req);
    if (!createResult.success || !createResult.data) {
      return createResult;
    }

    const analyzeResult = await this.analyzeSession(createResult.data.sessionId);
    if (!analyzeResult.success) {
      return {
        ...analyzeResult,
        data: createResult.data,
      };
    }

    return analyzeResult;
  }
}
