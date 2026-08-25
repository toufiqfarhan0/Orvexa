import type { HealthCheckResponse } from '@orvexa/shared';

export interface MigrationAnalysisRequest {
  sql: string;
  targetSchema?: string;
}

export interface ClientApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
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
        return {
          success: false,
          error: `Health probe failed with HTTP ${res.status}`,
        };
      }
      const data: HealthCheckResponse = await res.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network connection failed',
      };
    }
  }

  /**
   * Submits a migration SQL script for static AST analysis and risk evaluation.
   * Note: Dedicated REST endpoint for analysis is planned for a coordinated backend integration milestone.
   */
  static async submitAnalysis(_req: MigrationAnalysisRequest): Promise<ClientApiResult<unknown>> {
    try {
      const res = await fetch('/api/migrations/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_req),
      });

      if (res.status === 404) {
        return {
          success: false,
          isApiMissing: true,
          error:
            'The REST analysis endpoint (/api/migrations/analyze) is scheduled for backend wiring in the next milestone. Core engine analyzer is available via MCP.',
        };
      }

      if (!res.ok) {
        return {
          success: false,
          error: `Analysis failed with HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return { success: true, data };
    } catch {
      return {
        success: false,
        isApiMissing: true,
        error:
          'Backend REST analysis endpoint is not yet mounted. Core analysis services operate via MCP server.',
      };
    }
  }
}
