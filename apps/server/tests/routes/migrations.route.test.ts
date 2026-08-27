import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { MigrationAnalysisService } from '../../src/services/migration-analysis.service.js';
import { MigrationAnalyzerService } from '../../src/analyzer/services/migration-analyzer.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { config } from '../../src/config/env.js';

describe('Migrations REST API (/api/migrations)', () => {
  let repository: InMemoryMigrationSessionRepository;
  let sessionService: MigrationSessionService;
  let analysisService: MigrationAnalysisService;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();
    sessionService = new MigrationSessionService(repository);
    analysisService = new MigrationAnalysisService(repository, {
      analyzer: new MigrationAnalyzerService(),
    });
    app = createApp({ sessionService, analysisService });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/migrations (Create Session)', () => {
    it('creates a new migration session in DRAFT status with sanitized response', async () => {
      const payload = {
        sql: 'ALTER TABLE public.events ADD COLUMN marker integer NOT NULL DEFAULT 0;',
        target: {
          databaseName: 'test_db',
          schemaName: 'public',
          version: 'PostgreSQL 16',
        },
        name: 'add_marker_column',
      };

      const res = await request(app).post('/api/migrations').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.migrationId).toBeDefined();
      expect(res.body.data.target.databaseName).toBe('test_db');
      expect(res.body.data.target.schemaName).toBe('public');
      expect(res.body.data.proposedMigration.rawSql).toBe(payload.sql);

      // Verify no sensitive credentials leaked
      expect(res.body.data.target.password).toBeUndefined();
      expect(res.body.data.target.connectionString).toBeUndefined();
    });

    it('rejects empty or whitespace-only SQL with 400 validation error', async () => {
      const res = await request(app).post('/api/migrations').send({ sql: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-object body with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/migrations')
        .set('Content-Type', 'application/json')
        .send('"invalid string"');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('GET /api/migrations/:sessionId (Get Session)', () => {
    it('retrieves an existing migration session by ID', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'CREATE TABLE public.logs (id serial primary key);',
      });
      const sessionId = createRes.body.data.sessionId;

      const getRes = await request(app).get(`/api/migrations/${sessionId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.sessionId).toBe(sessionId);
      expect(getRes.body.data.status).toBe('DRAFT');
      expect(getRes.body.data.target.schemaName).toBe('public');
    });

    it('returns 404 SESSION_NOT_FOUND when session does not exist', async () => {
      const res = await request(app).get('/api/migrations/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('POST /api/migrations/:sessionId/analyze (Analyze Session)', () => {
    it('invokes deterministic analysis and transitions session to SANDBOX_READY', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN marker integer NOT NULL DEFAULT 0;',
      });
      const sessionId = createRes.body.data.sessionId;

      const analyzeRes = await request(app).post(`/api/migrations/${sessionId}/analyze`);

      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.success).toBe(true);
      expect(analyzeRes.body.data.sessionId).toBe(sessionId);
      expect(analyzeRes.body.data.status).toBe('SANDBOX_READY');
      expect(analyzeRes.body.data.analysisResult).toBeDefined();
      expect(analyzeRes.body.data.riskAssessment).toBeDefined();
      expect(analyzeRes.body.data.riskAssessment.overallRiskLevel).toBeDefined();
      expect(analyzeRes.body.data.sandboxEligibility.eligible).toBe(true);
    });

    it('returns 404 when analyzing non-existent session', async () => {
      const res = await request(app).post('/api/migrations/missing-session/analyze');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('returns 409 conflict when session is not in DRAFT or ANALYSIS_FAILED status', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'CREATE TABLE public.test (id int);',
      });
      const sessionId = createRes.body.data.sessionId;

      // First analysis transitions to SANDBOX_READY
      await request(app).post(`/api/migrations/${sessionId}/analyze`);

      // Second analysis attempt on SANDBOX_READY throws illegal action error
      const secondRes = await request(app).post(`/api/migrations/${sessionId}/analyze`);

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
    });

    it('persists ANALYSIS_FAILED status on failure and allows inspection', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN bad_col text;',
      });
      const sessionId = createRes.body.data.sessionId;

      // Force failure during analysis
      vi.spyOn(analysisService['analyzer'], 'analyze').mockRejectedValueOnce(
        new Error('Database inspection timeout')
      );

      const analyzeRes = await request(app).post(`/api/migrations/${sessionId}/analyze`);
      expect(analyzeRes.status).toBe(500);

      // Verify the session remains accessible and moved to ANALYSIS_FAILED
      const getRes = await request(app).get(`/api/migrations/${sessionId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.sessionId).toBe(sessionId);
      expect(getRes.body.data.status).toBe('ANALYSIS_FAILED');
    });
  });

  describe('Finding Remediations (Security, Composition & Concurrency)', () => {
    it('Finding #1: Sanitizes internal error messages in production mode', async () => {
      const origEnv = config.nodeEnv;
      config.nodeEnv = 'production';
      process.env.NODE_ENV = 'production';

      try {
        vi.spyOn(sessionService, 'createSession').mockRejectedValueOnce(
          new Error('Sensitive postgresql://user:secret_pwd@localhost:5432 internal stack trace')
        );

        const res = await request(app).post('/api/migrations').send({
          sql: 'CREATE TABLE t (id int);',
        });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(res.body.error.message).toBe('An internal error occurred.');
        expect(res.body.error.message).not.toContain('secret_pwd');
      } finally {
        config.nodeEnv = origEnv;
        process.env.NODE_ENV = origEnv;
      }
    });

    it('Finding #4: Partial dependency injection shares repository between session & analysis services', async () => {
      const sharedRepo = new InMemoryMigrationSessionRepository();
      // Inject only sessionRepository into createApp
      const partialApp = createApp({ sessionRepository: sharedRepo });

      const createRes = await request(partialApp).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN partial_col int NOT NULL DEFAULT 1;',
      });

      expect(createRes.status).toBe(201);
      const sessionId = createRes.body.data.sessionId;

      // Analyze using the auto-constructed analysisService backed by the same shared repo
      const analyzeRes = await request(partialApp).post(`/api/migrations/${sessionId}/analyze`);
      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.data.status).toBe('SANDBOX_READY');
    });

    it('Finding #7: Single-flight concurrency lock rejects simultaneous analysis on same session', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'CREATE TABLE public.concurrent_test (id serial primary key);',
      });
      const sessionId = createRes.body.data.sessionId;

      vi.spyOn(analysisService['analyzer'], 'analyze').mockImplementationOnce(
        async () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  analysisResult: {
                    analysisId: 'ana-1',
                    analyzedAt: new Date().toISOString(),
                    summary: 'ok',
                    findings: [],
                    isSafeForSandbox: true,
                    blockers: [],
                  },
                  riskAssessment: {
                    overallRiskLevel: 'LOW',
                    overallScore: 0,
                    summary: 'ok',
                    lockAnalysis: { lockMode: 'ACCESS_EXCLUSIVE' },
                    categoryAssessments: {},
                    assessedAt: new Date().toISOString(),
                  },
                }),
              50
            );
          })
      );

      // Launch both requests simultaneously
      const [resA, resB] = await Promise.all([
        request(app).post(`/api/migrations/${sessionId}/analyze`),
        request(app).post(`/api/migrations/${sessionId}/analyze`),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const errorRes = resA.status === 409 ? resA : resB;
      expect(errorRes.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(errorRes.body.error.message).toContain('already in progress');
    });
  });

  describe('POST /api/migrations/:sessionId/executive-brief', () => {
    let mockVerifyConn: ReturnType<typeof vi.spyOn>;
    let mockCreateSession: ReturnType<typeof vi.spyOn>;
    let mockSendTurn: ReturnType<typeof vi.spyOn>;
    let mockDeleteSession: ReturnType<typeof vi.spyOn>;
    let mockConfigProvider: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const { TrueForgeAdapter } = await import('../../src/trueforge/trueforge.adapter.js');
      mockVerifyConn = vi
        .spyOn(TrueForgeAdapter.prototype, 'verifyConnectivity')
        .mockResolvedValue({
          reachable: true,
          baseUrl: 'http://localhost:8790',
          version: '0.1.4',
          statusMessage: 'Online',
        });

      mockCreateSession = vi.spyOn(TrueForgeAdapter.prototype, 'createSession').mockResolvedValue({
        sessionId: 'tf-session-123',
        model: 'google-gemini/gemini-3-6-flash',
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      mockSendTurn = vi.spyOn(TrueForgeAdapter.prototype, 'sendTurn').mockResolvedValue({
        sessionId: 'tf-session-123',
        turnId: 'turn-1',
        status: 'completed',
        text: '## Executive Summary\nMigration is safe for deployment.',
        events: [],
        durationMs: 45,
      });

      mockDeleteSession = vi.spyOn(TrueForgeAdapter.prototype, 'deleteSession').mockResolvedValue();
      mockConfigProvider = vi
        .spyOn(TrueForgeAdapter.prototype, 'configureModelProvider')
        .mockResolvedValue();
    });

    it('Finding #1 & #6: Generates executive brief successfully with normalized model and cleans up session', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(briefRes.status).toBe(200);
      expect(briefRes.body.success).toBe(true);
      expect(briefRes.body.data.summary).toContain('## Executive Summary');
      expect(briefRes.body.data.model).toBe('google-gemini/gemini-3-6-flash');
      expect(briefRes.body.data.agentSessionId).toBe('tf-session-123');
      expect(mockCreateSession).toHaveBeenCalled();

      // Finding #3: Verify deleteSession cleanup was called
      expect(mockDeleteSession).toHaveBeenCalledWith('tf-session-123');
    });

    it('Finding #1: Rejects failed TrueForge turns with 502 EXTERNAL_SERVICE_ERROR', async () => {
      mockSendTurn.mockResolvedValueOnce({
        sessionId: 'tf-session-123',
        turnId: 'turn-failed',
        status: 'failed',
        text: '',
        events: [],
        durationMs: 120,
      });

      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(briefRes.status).toBe(502);
      expect(briefRes.body.success).toBe(false);
      expect(briefRes.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(briefRes.body.error.message).toContain("status: 'failed'");

      // Finding #3: Session was still cleaned up in finally
      expect(mockDeleteSession).toHaveBeenCalledWith('tf-session-123');
    });

    it('Finding #2: Passes explicit failure context to model prompt when rehearsal failed', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      // Update session with failed rehearsal evidence
      const session = await sessionService.getSession(sessionId);
      session.rehearsalEvidence = {
        rehearsalId: 'reh-fail-1',
        sessionId,
        migrationId: session.request.proposedMigration.migrationId,
        status: 'FAILED',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 350,
        exitCode: 1,
        stdout: '',
        stderr: 'relation "public.events" does not exist',
        statementsAttempted: 1,
        statementsSucceeded: 0,
        statementsFailed: 1,
        statementResults: [],
        affectedTables: ['public.events'],
        preMigrationInspection: [],
        postMigrationInspection: [],
        schemaDifferences: {
          addedColumns: [],
          removedColumns: [],
          modifiedColumns: [],
          addedIndexes: [],
          removedIndexes: [],
          modifiedIndexes: [],
          addedConstraints: [],
          removedConstraints: [],
          modifiedConstraints: [],
          totalModifications: 0,
        },
        rollbackStatus: 'DISCARDED',
        cleanupStatus: 'COMPLETED',
        failureReason: 'relation "public.events" does not exist',
        targetUntouched: true,
      };
      await repository.save(MigrationSessionEntity.fromSnapshot(session));

      await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(mockSendTurn).toHaveBeenCalled();
      const promptArg = mockSendTurn.mock.calls[0][0].message;
      expect(promptArg).toContain('"status": "FAILED"');
      expect(promptArg).toContain('"success": false');
      expect(promptArg).toContain('relation \\"public.events\\" does not exist');
    });

    it('Finding #2: Passes explicit success context to model prompt when rehearsal succeeded', async () => {
      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const session = await sessionService.getSession(sessionId);
      session.rehearsalEvidence = {
        rehearsalId: 'reh-succ-1',
        sessionId,
        migrationId: session.request.proposedMigration.migrationId,
        status: 'SUCCESS',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 42,
        exitCode: 0,
        stdout: 'ALTER TABLE',
        stderr: '',
        statementsAttempted: 1,
        statementsSucceeded: 1,
        statementsFailed: 0,
        statementResults: [],
        affectedTables: ['public.events'],
        preMigrationInspection: [],
        postMigrationInspection: [],
        schemaDifferences: {
          addedColumns: [],
          removedColumns: [],
          modifiedColumns: [],
          addedIndexes: [],
          removedIndexes: [],
          modifiedIndexes: [],
          addedConstraints: [],
          removedConstraints: [],
          modifiedConstraints: [],
          totalModifications: 0,
        },
        rollbackStatus: 'DISCARDED',
        cleanupStatus: 'COMPLETED',
        targetUntouched: true,
      };
      await repository.save(MigrationSessionEntity.fromSnapshot(session));

      await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(mockSendTurn).toHaveBeenCalled();
      const promptArg = mockSendTurn.mock.calls[0][0].message;
      expect(promptArg).toContain('"status": "SUCCESS"');
      expect(promptArg).toContain('"success": true');
    });

    it('Finding #3: Always executes deleteSession cleanup on unexpected exception', async () => {
      mockSendTurn.mockRejectedValueOnce(new Error('Network socket disconnected'));

      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(briefRes.status).toBe(500);
      expect(mockDeleteSession).toHaveBeenCalledWith('tf-session-123');
    });

    it('Finding #4: Rejects with 500 CONFIGURATION_ERROR when TrueForge is unreachable and no Gemini key is provided', async () => {
      const origKey = config.trueforge.geminiApiKey;
      config.trueforge.geminiApiKey = undefined;

      try {
        mockVerifyConn.mockResolvedValueOnce({
          reachable: false,
          baseUrl: 'http://localhost:8790',
          statusMessage: 'Connection refused',
        });

        const createRes = await request(app).post('/api/migrations').send({
          sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
        });
        const sessionId = createRes.body.data.sessionId;

        const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

        expect(briefRes.status).toBe(500);
        expect(briefRes.body.error.code).toBe('CONFIGURATION_ERROR');
        expect(briefRes.body.error.message).toContain('TrueForge agent server is not reachable');
      } finally {
        config.trueforge.geminiApiKey = origKey;
      }
    });

    it('Finding #4: Rejects with 500 CONFIGURATION_ERROR when model provider configuration fails', async () => {
      const origKey = config.trueforge.geminiApiKey;
      config.trueforge.geminiApiKey = 'test-gemini-api-key';
      mockConfigProvider.mockRejectedValueOnce(new Error('HTTP 401 Unauthorized API key'));

      try {
        const createRes = await request(app).post('/api/migrations').send({
          sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
        });
        const sessionId = createRes.body.data.sessionId;

        const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

        expect(briefRes.status).toBe(500);
        expect(briefRes.body.error.code).toBe('CONFIGURATION_ERROR');
        expect(briefRes.body.error.message).toContain(
          'Failed to configure model provider in TrueForge'
        );
      } finally {
        config.trueforge.geminiApiKey = origKey;
      }
    });

    it('Finding #5: Enforces per-session single-flight in-flight guard and returns 409 CONFLICT_ERROR for concurrent calls', async () => {
      mockSendTurn.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  sessionId: 'tf-session-123',
                  turnId: 'turn-1',
                  status: 'completed',
                  text: 'Brief content',
                  events: [],
                  durationMs: 80,
                }),
              80
            )
          )
      );

      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const [resA, resB] = await Promise.all([
        request(app).post(`/api/migrations/${sessionId}/executive-brief`),
        request(app).post(`/api/migrations/${sessionId}/executive-brief`),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const errorRes = resA.status === 409 ? resA : resB;
      expect(errorRes.body.error.code).toBe('CONFLICT_ERROR');
      expect(errorRes.body.error.message).toContain('already in-flight');
    });

    it('Security Check: Sanitizes provider errors and does not expose bearer tokens or passwords', async () => {
      mockSendTurn.mockRejectedValueOnce(new Error('Failure: key sk-live-secret-123456 failed'));

      const createRes = await request(app).post('/api/migrations').send({
        sql: 'ALTER TABLE public.events ADD COLUMN tag text;',
      });
      const sessionId = createRes.body.data.sessionId;

      const briefRes = await request(app).post(`/api/migrations/${sessionId}/executive-brief`);

      expect(briefRes.status).toBe(500);
      expect(JSON.stringify(briefRes.body)).not.toContain('sk-live-secret-123456');
    });
  });
});
