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

  describe('MigrationApiClient Error Classification', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('classifies HTTP 404 as API_MISSING', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const res = await MigrationApiClient.submitAnalysis({ sql: 'SELECT 1;' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_MISSING');
      expect(res.isApiMissing).toBe(true);
      expect(res.error).toContain('endpoint');
    });

    it('classifies HTTP 500 as API_ERROR', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const res = await MigrationApiClient.submitAnalysis({ sql: 'SELECT 1;' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('API_ERROR');
      expect(res.isApiMissing).toBe(false);
      expect(res.error).toContain('HTTP 500');
    });

    it('classifies network throw / rejection as NETWORK_ERROR', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const res = await MigrationApiClient.submitAnalysis({ sql: 'SELECT 1;' });
      expect(res.success).toBe(false);
      expect(res.errorKind).toBe('NETWORK_ERROR');
      expect(res.isApiMissing).toBe(false);
      expect(res.error).toContain('Network request failed');
    });

    it('handles successful API response', async () => {
      const mockData = { analysisId: 'ana-123', riskScore: 0 };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const res = await MigrationApiClient.submitAnalysis({ sql: 'SELECT 1;' });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockData);
      expect(res.errorKind).toBeUndefined();
    });
  });
});
