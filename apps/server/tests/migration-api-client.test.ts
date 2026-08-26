import { describe, it, expect, vi, afterEach } from 'vitest';
import { MigrationApiClient } from '../../web/src/services/migration-api.service.js';
import { normalizePath } from '../../web/src/router/Router.js';
import { getStepVisualState } from '../../web/src/components/console/SessionStatusPanel.js';

describe('Migration Console Unit Tests & Correctness Guarantees', () => {
  describe('Path Normalization (Router)', () => {
    it('normalizes root path', () => {
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('')).toBe('/');
      expect(normalizePath(null)).toBe('/');
      expect(normalizePath(undefined)).toBe('/');
    });

    it('normalizes console paths with or without trailing slashes', () => {
      expect(normalizePath('/console')).toBe('/console');
      expect(normalizePath('/console/')).toBe('/console');
      expect(normalizePath('/console///')).toBe('/console');
      expect(normalizePath(' /console/ ')).toBe('/console');
    });

    it('handles other routes correctly', () => {
      expect(normalizePath('/docs/api/')).toBe('/docs/api');
      expect(normalizePath('/settings')).toBe('/settings');
    });
  });

  describe('Lifecycle Cumulative Progression Mapping', () => {
    it('evaluates DRAFT status', () => {
      expect(getStepVisualState(0, 'DRAFT')).toBe('current');
      expect(getStepVisualState(1, 'DRAFT')).toBe('pending');
      expect(getStepVisualState(2, 'DRAFT')).toBe('pending');
      expect(getStepVisualState(3, 'DRAFT')).toBe('pending');
      expect(getStepVisualState(4, 'DRAFT')).toBe('pending');
    });

    it('evaluates ANALYZING status', () => {
      expect(getStepVisualState(0, 'ANALYZING')).toBe('completed');
      expect(getStepVisualState(1, 'ANALYZING')).toBe('current');
      expect(getStepVisualState(2, 'ANALYZING')).toBe('pending');
    });

    it('evaluates ANALYSIS_FAILED status', () => {
      expect(getStepVisualState(0, 'ANALYSIS_FAILED')).toBe('completed');
      expect(getStepVisualState(1, 'ANALYSIS_FAILED')).toBe('failed');
      expect(getStepVisualState(2, 'ANALYSIS_FAILED')).toBe('pending');
    });

    it('evaluates SANDBOX_READY / SANDBOX_RUNNING status', () => {
      expect(getStepVisualState(0, 'SANDBOX_READY')).toBe('completed');
      expect(getStepVisualState(1, 'SANDBOX_READY')).toBe('completed');
      expect(getStepVisualState(2, 'SANDBOX_READY')).toBe('current');
      expect(getStepVisualState(3, 'SANDBOX_READY')).toBe('pending');
    });

    it('evaluates SANDBOX_FAILED status', () => {
      expect(getStepVisualState(0, 'SANDBOX_FAILED')).toBe('completed');
      expect(getStepVisualState(1, 'SANDBOX_FAILED')).toBe('completed');
      expect(getStepVisualState(2, 'SANDBOX_FAILED')).toBe('failed');
      expect(getStepVisualState(3, 'SANDBOX_FAILED')).toBe('pending');
    });

    it('evaluates SANDBOX_REHEARSAL_COMPLETED and AWAITING_APPROVAL status', () => {
      expect(getStepVisualState(0, 'AWAITING_APPROVAL')).toBe('completed');
      expect(getStepVisualState(1, 'AWAITING_APPROVAL')).toBe('completed');
      expect(getStepVisualState(2, 'AWAITING_APPROVAL')).toBe('completed');
      expect(getStepVisualState(3, 'AWAITING_APPROVAL')).toBe('current');
      expect(getStepVisualState(4, 'AWAITING_APPROVAL')).toBe('pending');
    });

    it('evaluates REJECTED status', () => {
      expect(getStepVisualState(0, 'REJECTED')).toBe('completed');
      expect(getStepVisualState(1, 'REJECTED')).toBe('completed');
      expect(getStepVisualState(2, 'REJECTED')).toBe('completed');
      expect(getStepVisualState(3, 'REJECTED')).toBe('failed');
      expect(getStepVisualState(4, 'REJECTED')).toBe('pending');
    });

    it('evaluates APPROVED, EXECUTING, and VERIFYING status', () => {
      expect(getStepVisualState(0, 'APPROVED')).toBe('completed');
      expect(getStepVisualState(1, 'APPROVED')).toBe('completed');
      expect(getStepVisualState(2, 'APPROVED')).toBe('completed');
      expect(getStepVisualState(3, 'APPROVED')).toBe('completed');
      expect(getStepVisualState(4, 'APPROVED')).toBe('current');
    });

    it('evaluates EXECUTION_FAILED and VERIFICATION_FAILED status', () => {
      expect(getStepVisualState(0, 'EXECUTION_FAILED')).toBe('completed');
      expect(getStepVisualState(1, 'EXECUTION_FAILED')).toBe('completed');
      expect(getStepVisualState(2, 'EXECUTION_FAILED')).toBe('completed');
      expect(getStepVisualState(3, 'EXECUTION_FAILED')).toBe('completed');
      expect(getStepVisualState(4, 'EXECUTION_FAILED')).toBe('failed');
    });

    it('evaluates COMPLETED status', () => {
      for (let i = 0; i <= 4; i++) {
        expect(getStepVisualState(i, 'COMPLETED')).toBe('completed');
      }
    });
  });

  describe('MigrationApiClient Methods & Error Handling', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('createSession handles 201 Created success', async () => {
      const mockSession = {
        sessionId: 'sess-real-123',
        status: 'DRAFT',
        migrationId: 'mig-123',
        target: {
          engine: 'postgresql',
          version: 'PostgreSQL 16',
          databaseName: 'orvexa_db',
          schemaName: 'public',
        },
        createdAt: new Date().toISOString(),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockSession }),
      });

      const res = await MigrationApiClient.createSession({ sql: 'SELECT 1;' });
      expect(res.success).toBe(true);
      expect(res.data?.sessionId).toBe('sess-real-123');
      expect(res.data?.status).toBe('DRAFT');
    });

    it('createSession handles 400 Validation Error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'SQL cannot be empty' },
        }),
      });

      const res = await MigrationApiClient.createSession({ sql: '' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.error).toBe('SQL cannot be empty');
    });

    it('createSession handles 404 missing endpoint (non-JSON)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const res = await MigrationApiClient.createSession({ sql: 'SELECT 1;' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_MISSING');
      expect(res.isApiMissing).toBe(true);
    });

    it('Finding #5: Distinguishes SESSION_NOT_FOUND (404) from missing API endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: "Migration session with ID 'sess-404' was not found.",
          },
        }),
      });

      const res = await MigrationApiClient.getSession('sess-404');
      expect(res.success).toBe(false);
      // Structured 404 must be classified as API_ERROR with real message, NOT API_MISSING
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.isApiMissing).toBe(false);
      expect(res.error).toContain('was not found');
    });

    it('Finding #6: Distinguishes malformed JSON response from network failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const res = await MigrationApiClient.getSession('sess-real-123');
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.isApiMissing).toBe(false);
      expect(res.error).toContain('Invalid JSON response');
    });

    it('createSession handles network rejection', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const res = await MigrationApiClient.createSession({ sql: 'SELECT 1;' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('NETWORK_ERROR');
      expect(res.error).toContain('Network request failed');
    });

    it('analyzeSession handles 200 OK analysis result', async () => {
      const mockAnalysis = {
        sessionId: 'sess-real-123',
        status: 'SANDBOX_READY',
        migrationId: 'mig-123',
        riskAssessment: { overallRiskLevel: 'LOW', overallScore: 0 },
        sandboxEligibility: { eligible: true, requiresSandbox: true },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockAnalysis }),
      });

      const res = await MigrationApiClient.analyzeSession('sess-real-123');
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('SANDBOX_READY');
      expect(res.data?.riskAssessment?.overallRiskLevel).toBe('LOW');
    });

    it('getSession handles 200 OK', async () => {
      const mockSession = {
        sessionId: 'sess-real-123',
        status: 'DRAFT',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockSession }),
      });

      const res = await MigrationApiClient.getSession('sess-real-123');
      expect(res.success).toBe(true);
      expect(res.data?.sessionId).toBe('sess-real-123');
    });

    it('Finding #8: createAndAnalyze preserves created session data when analyze fails', async () => {
      const mockSession = {
        sessionId: 'sess-retained-1',
        status: 'DRAFT',
      };

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: mockSession }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Analysis failed' },
          }),
        });

      const res = await MigrationApiClient.createAndAnalyze({ sql: 'ALTER TABLE t ADD c int;' });
      expect(res.success).toBe(false);
      // Created session must be retained in data so the caller doesn't orphan the session
      expect(res.data?.sessionId).toBe('sess-retained-1');
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.error).toBe('Analysis failed');
    });

    it('runRehearsal handles 200 OK success', async () => {
      const mockRehearsalResponse = {
        sessionId: 'sess-real-123',
        migrationId: 'mig-123',
        rehearsalId: 'reh-123',
        status: 'SUCCESS',
        exitCode: 0,
        statementsAttempted: 1,
        statementsSucceeded: 1,
        statementsFailed: 0,
        targetUntouched: true,
        cleanupStatus: 'COMPLETED',
        session: {
          sessionId: 'sess-real-123',
          status: 'SANDBOX_REHEARSAL_COMPLETED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockRehearsalResponse }),
      });

      const res = await MigrationApiClient.runRehearsal('sess-real-123');
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('SUCCESS');
      expect(res.data?.targetUntouched).toBe(true);
      expect(res.data?.session?.status).toBe('SANDBOX_REHEARSAL_COMPLETED');
    });

    it('runRehearsal handles 409 ILLEGAL_STATE_TRANSITION error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'ILLEGAL_STATE_TRANSITION',
            message: "Cannot start rehearsal from 'DRAFT' status.",
          },
        }),
      });

      const res = await MigrationApiClient.runRehearsal('sess-real-123');
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.error).toContain('Cannot start rehearsal');
    });

    it('runRehearsal handles network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection dropped'));

      const res = await MigrationApiClient.runRehearsal('sess-real-123');
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('NETWORK_ERROR');
      expect(res.error).toContain('Network request failed');
    });

    it('requestApproval handles 200 OK success', async () => {
      const mockApprovalResponse = {
        approvalRequestId: 'appr_req_123',
        sessionId: 'sess-123',
        status: 'AWAITING_APPROVAL',
        fingerprint: 'abc123fingerprint',
        highestRiskLevel: 'LOW',
        reasonsRequired: ['Low risk migration'],
        session: {
          sessionId: 'sess-123',
          status: 'AWAITING_APPROVAL',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockApprovalResponse }),
      });

      const res = await MigrationApiClient.requestApproval(
        'sess-123',
        'Engineer',
        'Ready for approval'
      );
      expect(res.success).toBe(true);
      expect(res.data?.approvalRequestId).toBe('appr_req_123');
      expect(res.data?.status).toBe('AWAITING_APPROVAL');
      expect(res.data?.fingerprint).toBe('abc123fingerprint');
    });

    it('approveMigration handles 200 OK success', async () => {
      const mockApproveResponse = {
        decisionId: 'appr_dec_123',
        approvalRequestId: 'appr_req_123',
        sessionId: 'sess-123',
        status: 'APPROVED',
        approver: 'LeadDBA',
        decidedAt: new Date().toISOString(),
        fingerprint: 'abc123fingerprint',
        session: {
          sessionId: 'sess-123',
          status: 'APPROVED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockApproveResponse }),
      });

      const res = await MigrationApiClient.approveMigration(
        'sess-123',
        'LeadDBA',
        'Approved',
        'abc123fingerprint'
      );
      expect(res.success).toBe(true);
      expect(res.data?.decisionId).toBe('appr_dec_123');
      expect(res.data?.status).toBe('APPROVED');
      expect(res.data?.approver).toBe('LeadDBA');
    });

    it('rejectMigration handles 200 OK success', async () => {
      const mockRejectResponse = {
        decisionId: 'appr_dec_456',
        approvalRequestId: 'appr_req_123',
        sessionId: 'sess-123',
        status: 'REJECTED',
        approver: 'LeadDBA',
        rejectionReason: 'Schema naming convention violation',
        decidedAt: new Date().toISOString(),
        fingerprint: 'abc123fingerprint',
        session: {
          sessionId: 'sess-123',
          status: 'REJECTED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockRejectResponse }),
      });

      const res = await MigrationApiClient.rejectMigration(
        'sess-123',
        'LeadDBA',
        'Schema naming convention violation',
        'abc123fingerprint'
      );
      expect(res.success).toBe(true);
      expect(res.data?.decisionId).toBe('appr_dec_456');
      expect(res.data?.status).toBe('REJECTED');
      expect(res.data?.rejectionReason).toBe('Schema naming convention violation');
    });
  });
});
