import type { HealthCheckResponse } from '@orvexa/shared';

export interface MigrationAnalysisRequest {
  sql: string;
  targetSchema?: string;
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
 * Provides a clean interface for communicating with Orvexa backend engine services.
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
   * Submits a migration SQL script for static AST analysis and risk evaluation.
   * Accurately distinguishes HTTP 404 (endpoint not mounted), HTTP 500+ (server error),
   * and network rejection (offline/unreachable).
   */
  static async submitAnalysis(req: MigrationAnalysisRequest): Promise<ClientApiResult<unknown>> {
    try {
      const res = await fetch('/api/migrations/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.status === 404) {
        return {
          success: false,
          errorKind: 'API_MISSING',
          isApiMissing: true,
          error:
            'The REST analysis endpoint (/api/migrations/analyze) is scheduled for backend wiring in the next milestone. Core engine analyzer is available via MCP.',
        };
      }

      if (!res.ok) {
        return {
          success: false,
          errorKind: 'API_ERROR',
          isApiMissing: false,
          error: `Backend server error (HTTP ${res.status}): ${res.statusText || 'Analysis request failed'}`,
        };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        errorKind: 'NETWORK_ERROR',
        isApiMissing: false,
        error:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Network connection failed. Backend server may be offline or unreachable.',
      };
    }
  }
}
