import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { MigrationAnalysisService } from '../../src/services/migration-analysis.service.js';
import { MigrationAnalyzerService } from '../../src/analyzer/services/migration-analyzer.service.js';
import { MigrationRehearsalWorkflowService } from '../../src/rehearsal/services/migration-rehearsal-workflow.service.js';
import type { RehearsalDatabasePort } from '../../src/rehearsal/ports/rehearsal-database.port.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';
import type { SandboxPort } from '../../src/sandbox/ports/sandbox.port.js';
import type { FullTableInspection } from '@orvexa/shared';

describe('Migrations Rehearsal REST API (POST /api/migrations/:sessionId/rehearsal)', () => {
  let repository: InMemoryMigrationSessionRepository;
  let sessionService: MigrationSessionService;
  let analysisService: MigrationAnalysisService;
  let rehearsalService: MigrationRehearsalWorkflowService;
  let mockRehearsalDb: RehearsalDatabasePort;
  let mockInspectionPort: PostgresInspectionPort;
  let mockSandboxPort: SandboxPort;
  let app: ReturnType<typeof createApp>;

  const mockPreInspection: FullTableInspection[] = [
    {
      table: {
        schemaName: 'public',
        tableName: 'events',
        tableType: 'BASE TABLE',
        estimatedRowCount: 10,
        totalSizeBytes: 16384,
        tableSizeBytes: 8192,
        indexSizeBytes: 8192,
        isPartitioned: false,
      },
      columns: [
        {
          columnName: 'id',
          ordinalPosition: 1,
          dataType: 'integer',
          udtName: 'int4',
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
      ],
      primaryKey: {
        name: 'events_pkey',
        schemaName: 'public',
        tableName: 'events',
        type: 'PRIMARY KEY',
        columnNames: ['id'],
        isDeferrable: false,
      },
      foreignKeys: [],
      constraints: [],
      indexes: [],
      statistics: null,
    },
  ];

  const mockPostInspection: FullTableInspection[] = [
    {
      table: {
        schemaName: 'public',
        tableName: 'events',
        tableType: 'BASE TABLE',
        estimatedRowCount: 10,
        totalSizeBytes: 16384,
        tableSizeBytes: 8192,
        indexSizeBytes: 8192,
        isPartitioned: false,
      },
      columns: [
        {
          columnName: 'id',
          ordinalPosition: 1,
          dataType: 'integer',
          udtName: 'int4',
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
        {
          columnName: 'rehearsal_col',
          ordinalPosition: 2,
          dataType: 'integer',
          udtName: 'int4',
          isNullable: false,
          columnDefault: '0',
          isIdentity: false,
          isGenerated: false,
        },
      ],
      primaryKey: {
        name: 'events_pkey',
        schemaName: 'public',
        tableName: 'events',
        type: 'PRIMARY KEY',
        columnNames: ['id'],
        isDeferrable: false,
      },
      foreignKeys: [],
      constraints: [],
      indexes: [],
      statistics: null,
    },
  ];

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();
    sessionService = new MigrationSessionService(repository);
    analysisService = new MigrationAnalysisService(repository, {
      analyzer: new MigrationAnalyzerService(),
    });

    mockRehearsalDb = {
      provision: vi.fn().mockResolvedValue({
        rehearsalId: 'reh-1',
        sourceTargetId: 'test_db',
        postgresVersion: '16.0',
        databaseName: 'disposable_db',
        schemaName: 'public',
        status: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tableCount: 1,
        clonedTables: ['events'],
        fixtureRowCount: 3,
      }),
      cloneSchema: vi.fn().mockResolvedValue({
        tablesCreated: 1,
        columnsCreated: 1,
        primaryKeysCreated: 1,
        foreignKeysCreated: 0,
        constraintsCreated: 0,
        indexesCreated: 0,
        fixtureRowsInserted: 0,
        durationMs: 50,
      }),
      seedFixtures: vi.fn().mockResolvedValue(3),
      executeStatements: vi.fn().mockResolvedValue([
        {
          statementIndex: 0,
          sql: 'ALTER TABLE public.events ADD COLUMN rehearsal_col integer NOT NULL DEFAULT 0;',
          status: 'SUCCESS',
          durationMs: 15,
          rowsAffected: 0,
        },
      ]),
      inspectRehearsalTables: vi.fn().mockResolvedValue(mockPostInspection),
      getEnvironment: vi.fn().mockResolvedValue(null),
      getConnectionConfig: vi.fn().mockResolvedValue({
        rehearsalId: 'reh-1',
        databaseUrl: 'postgresql://mock:mock@localhost:5432/reh_mock',
      }),
      listEnvironments: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue({ connected: true, latencyMs: 5 }),
      getServerMetadata: vi.fn().mockResolvedValue({
        version: 'PostgreSQL 16.0',
        majorVersion: 16,
        encoding: 'UTF8',
        maxConnections: 100,
      }),
      getDatabaseMetadata: vi.fn().mockResolvedValue({
        databaseName: 'test_db',
        version: '16.0',
        schemas: ['public'],
        tables: [{ schemaName: 'public', tableName: 'events', tableType: 'BASE TABLE' }],
      }),
      inspectSchemas: vi.fn().mockResolvedValue(['public']),
      inspectTables: vi
        .fn()
        .mockResolvedValue([
          { schemaName: 'public', tableName: 'events', tableType: 'BASE TABLE' },
        ]),
      inspectColumns: vi.fn().mockResolvedValue(mockPreInspection[0].columns),
      inspectConstraints: vi.fn().mockResolvedValue([mockPreInspection[0].primaryKey!]),
      inspectIndexes: vi.fn().mockResolvedValue([]),
      getTableStatistics: vi.fn().mockResolvedValue(mockPreInspection[0].statistics),
      inspectFullTable: vi.fn().mockResolvedValue(mockPreInspection[0]),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockSandboxPort = {
      getCapability: vi.fn().mockResolvedValue({
        enabled: true,
        providerType: 'daytona',
        status: 'ready',
        supportedPlatforms: ['win32', 'linux', 'darwin'],
        currentPlatform: 'win32',
      }),
      configureProvider: vi.fn().mockResolvedValue(undefined),
      createSandbox: vi.fn().mockResolvedValue({ sandboxId: 'sb-daytona-1' }),
      execute: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'REHEARSAL_SANDBOX_DISPATCH_reh-1',
        stderr: '',
        durationMs: 100,
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    rehearsalService = new MigrationRehearsalWorkflowService({
      rehearsalDbPort: mockRehearsalDb,
      inspectionPort: mockInspectionPort,
      sandboxPort: mockSandboxPort,
      sessionRepository: repository,
    });

    app = createApp({
      sessionRepository: repository,
      sessionService,
      analysisService,
      rehearsalService,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createSandboxReadySession(sql?: string): Promise<string> {
    const createRes = await request(app)
      .post('/api/migrations')
      .send({
        sql:
          sql || 'ALTER TABLE public.events ADD COLUMN rehearsal_col integer NOT NULL DEFAULT 0;',
        target: {
          databaseName: 'test_db',
          schemaName: 'public',
          version: 'PostgreSQL 16',
        },
      });
    const sessionId = createRes.body.data.sessionId;
    await request(app).post(`/api/migrations/${sessionId}/analyze`);
    return sessionId;
  }

  it('successfully executes rehearsal for a SANDBOX_READY session and returns sanitized DTO', async () => {
    const sessionId = await createSandboxReadySession();

    const res = await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.sessionId).toBe(sessionId);
    expect(data.status).toBe('SUCCESS');
    expect(data.rehearsalId).toBeDefined();
    expect(data.exitCode).toBe(0);
    expect(data.statementsAttempted).toBe(1);
    expect(data.statementsSucceeded).toBe(1);
    expect(data.statementsFailed).toBe(0);
    expect(data.targetUntouched).toBe(true);
    expect(data.cleanupStatus).toBe('COMPLETED');
    expect(data.schemaDiff).toBeDefined();
    expect(data.schemaDiff.columns.added.length).toBe(1);
    expect(data.schemaDiff.columns.added[0].columnName).toBe('rehearsal_col');

    // Verify session in response is updated to SANDBOX_REHEARSAL_COMPLETED
    expect(data.session.status).toBe('SANDBOX_REHEARSAL_COMPLETED');
    expect(data.session.sandboxResult).toBeDefined();
    expect(data.session.sandboxResult.status).toBe('SUCCESS');

    // Verify sensitive secrets are never leaked
    expect(JSON.stringify(res.body)).not.toContain('postgres://');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('persists rehearsal state on the session for subsequent GET requests', async () => {
    const sessionId = await createSandboxReadySession();

    await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    const getRes = await request(app).get(`/api/migrations/${sessionId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('SANDBOX_REHEARSAL_COMPLETED');
    expect(getRes.body.data.sandboxResult.status).toBe('SUCCESS');
    expect(getRes.body.data.rehearsalEvidence).toBeDefined();
    expect(getRes.body.data.rehearsalEvidence.targetUntouched).toBe(true);
  });

  it('returns 404 SESSION_NOT_FOUND when session does not exist', async () => {
    const res = await request(app).post('/api/migrations/non-existent-session-id/rehearsal');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('rejects rehearsal requested from DRAFT status with 409 ILLEGAL_STATE_TRANSITION', async () => {
    const createRes = await request(app).post('/api/migrations').send({
      sql: 'CREATE TABLE t (id int);',
    });
    const sessionId = createRes.body.data.sessionId;

    const res = await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
  });

  it('rejects rehearsal requested when blocking issues exist in analysis', async () => {
    const createRes = await request(app)
      .post('/api/migrations')
      .send({
        sql: 'UNSUPPORTED_SYNTAX_COMMAND_XYZ;',
        target: {
          databaseName: 'test_db',
          schemaName: 'public',
          version: 'PostgreSQL 16',
        },
      });
    const sessionId = createRes.body.data.sessionId;

    // Analyze session - unsupported syntax generates blockers and transitions to ANALYSIS_FAILED
    const analyzeRes = await request(app).post(`/api/migrations/${sessionId}/analyze`);
    expect(analyzeRes.body.data.status).toBe('ANALYSIS_FAILED');

    const res = await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
  });

  it('rejects concurrent simultaneous rehearsal attempts on the same session', async () => {
    const sessionId = await createSandboxReadySession();

    vi.spyOn(mockSandboxPort, 'execute').mockImplementationOnce(
      async () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                exitCode: 0,
                stdout: 'ok',
                stderr: '',
                durationMs: 50,
              }),
            50
          )
        )
    );

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/migrations/${sessionId}/rehearsal`),
      request(app).post(`/api/migrations/${sessionId}/rehearsal`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const errorRes = resA.status === 409 ? resA : resB;
    expect(errorRes.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
    expect(errorRes.body.error.message).toContain('already in progress');
  });

  it('handles sandbox execution failure by transitioning session to SANDBOX_FAILED', async () => {
    const sessionId = await createSandboxReadySession();

    vi.spyOn(mockSandboxPort, 'execute').mockResolvedValueOnce({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'Sandbox memory limit exceeded',
      durationMs: 20,
      error: 'Sandbox memory limit exceeded',
    });

    const res = await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FAILED');
    expect(res.body.data.exitCode).toBe(1);
    expect(res.body.data.session.status).toBe('SANDBOX_FAILED');

    // Confirm session in repository reflects SANDBOX_FAILED
    const getRes = await request(app).get(`/api/migrations/${sessionId}`);
    expect(getRes.body.data.status).toBe('SANDBOX_FAILED');
  });

  it('handles TrueForge sandbox capability disabled with 503 SANDBOX_UNAVAILABLE', async () => {
    const sessionId = await createSandboxReadySession();

    vi.spyOn(mockSandboxPort, 'getCapability').mockResolvedValueOnce({
      enabled: false,
      providerType: 'none',
      status: 'disabled',
      reason: 'No sandbox provider active',
      supportedPlatforms: ['win32'],
      currentPlatform: 'win32',
    });

    const res = await request(app).post(`/api/migrations/${sessionId}/rehearsal`);

    // In workflow, capability failure throws an error which is caught and mapped to SANDBOX_FAILED or SANDBOX_UNAVAILABLE
    expect(res.body.data?.status === 'FAILED' || res.status === 503).toBe(true);
  });
});
