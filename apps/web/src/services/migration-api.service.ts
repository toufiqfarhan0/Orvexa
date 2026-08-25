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
 * Migration API Client Boundary.
 * Provides typed, truth-preserving communication with Orvexa backend engine services.
 */
export class MigrationApiClient {
  /**
   * Fetches backend engine health diagnostics.
   */
  static async getHealth(): Promise<ClientApiResult<HealthCheckResponse>> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        if (res.status === 404) {
          return {
            success: false,
            errorKind: 'API_MISSING',
            isApiMissing: true,
            error: 'Health route not found (HTTP 404)',
          };
        }
        return {
          success: false,
          errorKind: 'API_ERROR',
          error: `Health probe failed with HTTP ${res.status}`,
        };
      }
      const data: HealthCheckResponse = await res.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        error: err instanceof Error ? `Network error: ${err.message}` : 'Network connection failed',
      };
    }
  }

  /**
   * Creates a new migration session on the backend.
   */
  static async createSession(req: CreateSessionRequest): Promise<ClientApiResult<ApiSessionData>> {
    try {
      const res = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.status === 404) {
        return {
          success: false,
          errorKind: 'API_MISSING',
          isApiMissing: true,
          error: 'Session creation endpoint (/api/migrations) was not found (HTTP 404).',
        };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          errorKind: 'API_ERROR',
          error: json.error?.message || `Failed to create migration session (HTTP ${res.status}).`,
        };
      }

      return { success: true, data: json.data };
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
  }

  /**
   * Triggers deterministic AST risk analysis on an existing session.
   */
  static async analyzeSession(sessionId: string): Promise<ClientApiResult<ApiSessionData>> {
    try {
      const res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 404) {
        return {
          success: false,
          errorKind: 'API_MISSING',
          isApiMissing: true,
          error: `Analysis endpoint for session '${sessionId}' was not found (HTTP 404).`,
        };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          errorKind: 'API_ERROR',
          error: json.error?.message || `Analysis failed (HTTP ${res.status}).`,
        };
      }

      return { success: true, data: json.data };
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
  }

  /**
   * Retrieves current session state and evidence.
   */
  static async getSession(sessionId: string): Promise<ClientApiResult<ApiSessionData>> {
    try {
      const res = await fetch(`/api/migrations/${encodeURIComponent(sessionId)}`);
      if (res.status === 404) {
        return {
          success: false,
          errorKind: 'API_MISSING',
          isApiMissing: true,
          error: `Session '${sessionId}' was not found (HTTP 404).`,
        };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          errorKind: 'API_ERROR',
          error: json.error?.message || `Failed to fetch session (HTTP ${res.status}).`,
        };
      }

      return { success: true, data: json.data };
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

    return await this.analyzeSession(createResult.data.sessionId);
  }
}
