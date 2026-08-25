import type {
  HealthCheckResponse,
  MigrationSessionStatus,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
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
  let json: { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null =
    null;

  try {
    json = await res.json();
  } catch {
    // If response was 404 and not valid JSON, route is unmounted
    if (res.status === 404) {
      return {
        success: false,
        errorKind: 'API_MISSING',
        isApiMissing: true,
        error: `${endpointDescription} was not found (HTTP 404).`,
      };
    }
    return {
      success: false,
      errorKind: 'API_ERROR',
      isApiMissing: false,
      error: `Invalid JSON response received from server (HTTP ${res.status}).`,
    };
  }

  // Handle HTTP 404 responses
  if (res.status === 404) {
    if (json?.error?.code === 'SESSION_NOT_FOUND') {
      return {
        success: false,
        errorKind: 'API_ERROR',
        isApiMissing: false,
        error: json.error.message || 'Migration session was not found.',
      };
    }
    return {
      success: false,
      errorKind: 'API_MISSING',
      isApiMissing: true,
      error: json?.error?.message || `${endpointDescription} was not found (HTTP 404).`,
    };
  }

  // Handle HTTP error status or unsuccessful payload
  if (!res.ok || !json?.success) {
    return {
      success: false,
      errorKind: 'API_ERROR',
      isApiMissing: false,
      error: json?.error?.message || `Request failed with HTTP ${res.status}.`,
    };
  }

  return { success: true, data: json.data };
}

/**
 * Migration API Client Boundary.
 * Provides typed, truth-preserving communication with Orvexa backend engine services.
 */
export class MigrationApiClient {
  /**
   * Fetches backend engine health diagnostics.
   */
  static async getHealth(): Promise<ClientApiResult<HealthCheckResponse>> {
    let res: Response;
    try {
      res = await fetch('/api/health');
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error: err instanceof Error ? `Network error: ${err.message}` : 'Network connection failed',
      };
    }

    return await parseJsonResponse<HealthCheckResponse>(res, 'Health route (/api/health)');
  }

  /**
   * Creates a new migration session on the backend.
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
      // Return error result but retain the created session data so callers never orphan the session
      return {
        ...analyzeResult,
        data: createResult.data,
      };
    }

    return analyzeResult;
  }
}
