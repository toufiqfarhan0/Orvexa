import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { MigrationAnalysisService } from '../../src/services/migration-analysis.service.js';
import { MigrationAnalyzerService } from '../../src/analyzer/services/migration-analyzer.service.js';

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
  });
});
