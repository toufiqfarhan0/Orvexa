import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MigrationRehearsalWorkflowService } from '../../src/rehearsal/services/migration-rehearsal-workflow.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import type { FullTableInspection } from '@orvexa/shared';
import type { RehearsalDatabasePort } from '../../src/rehearsal/ports/rehearsal-database.port.js';
import type { SandboxPort } from '../../src/sandbox/ports/sandbox.port.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';

describe('MigrationRehearsalWorkflowService (Unit Tests)', () => {
  let mockRehearsalDb: RehearsalDatabasePort;
  let mockInspectionPort: PostgresInspectionPort;
  let mockSandboxPort: SandboxPort;
  let sessionRepo: InMemoryMigrationSessionRepository;
  let workflowService: MigrationRehearsalWorkflowService;

  const mockPreInspection: FullTableInspection = {
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
        dataType: 'bigint',
        udtName: 'int8',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'event_type',
        ordinalPosition: 2,
        dataType: 'varchar',
        udtName: 'varchar',
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
    constraints: [],
    foreignKeys: [],
    indexes: [],
    statistics: null,
  };

  const mockPostInspection: FullTableInspection = {
    ...mockPreInspection,
    columns: [
      ...mockPreInspection.columns,
      {
        columnName: 'rehearsal_marker',
        ordinalPosition: 3,
        dataType: 'integer',
        udtName: 'int4',
        isNullable: false,
        columnDefault: '0',
        isIdentity: false,
        isGenerated: false,
      },
    ],
  };

  beforeEach(async () => {
    mockRehearsalDb = {
      provision: vi.fn().mockResolvedValue({
        rehearsalId: 'test-reh-123',
        sourceTargetId: 'testdb',
        postgresVersion: 'PostgreSQL 16',
        databaseName: 'rehearsal_test_reh_123',
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
        columnsCreated: 2,
        primaryKeysCreated: 1,
        foreignKeysCreated: 0,
        constraintsCreated: 0,
        indexesCreated: 0,
        fixtureRowsInserted: 3,
        durationMs: 20,
      }),
      seedFixtures: vi.fn().mockResolvedValue(3),
      executeStatements: vi.fn().mockResolvedValue([
        {
          statementIndex: 0,
          sql: 'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
          status: 'SUCCESS',
          durationMs: 15,
          rowsAffected: 0,
        },
      ]),
      inspectRehearsalTables: vi.fn().mockResolvedValue([mockPostInspection]),
      getEnvironment: vi.fn().mockResolvedValue(null),
      getConnectionConfig: vi.fn().mockResolvedValue({
        host: 'localhost',
        port: 5432,
        database: 'rehearsal_test_reh_123',
        user: 'postgres',
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
      listEnvironments: vi.fn().mockResolvedValue([]),
    };

    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue({
        connected: true,
        latencyMs: 2,
        database: 'testdb',
        currentUser: 'postgres',
      }),
      getServerMetadata: vi
        .fn()
        .mockResolvedValue({ version: '16.0', majorVersion: 16, serverEncoding: 'UTF8' }),
      getDatabaseMetadata: vi.fn().mockResolvedValue({
        databaseName: 'testdb',
        currentSchema: 'public',
        server: { version: '16.0', majorVersion: 16, serverEncoding: 'UTF8' },
        schemas: [{ name: 'public', owner: 'postgres' }],
        tables: [mockPreInspection.table],
      }),
      inspectSchemas: vi.fn().mockResolvedValue([{ name: 'public', owner: 'postgres' }]),
      inspectTables: vi.fn().mockResolvedValue([mockPreInspection.table]),
      inspectColumns: vi.fn().mockResolvedValue(mockPreInspection.columns),
      inspectConstraints: vi.fn().mockResolvedValue([]),
      inspectIndexes: vi.fn().mockResolvedValue([]),
      getTableStatistics: vi.fn().mockResolvedValue(null),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      inspectFullTable: vi.fn().mockResolvedValue(mockPreInspection),
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
      createSandbox: vi.fn().mockResolvedValue({ sandboxId: 'sb-workspace-999' }),
      execute: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'REHEARSAL_SANDBOX_DISPATCH_OK',
        stderr: '',
        durationMs: 50,
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    sessionRepo = new InMemoryMigrationSessionRepository();

    const session = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-test-1',
        name: 'Add marker column',
        rawSql: 'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
      },
    });
    session.beginAnalysis('test');
    session.recordAnalysisResult(
      {
        migrationId: 'mig-test-1',
        analyzedAt: new Date().toISOString(),
        isSafeForSandbox: true,
        statementAnalyses: [],
        findings: [],
        blockers: [],
        summary: 'Safe',
      },
      {
        overallRiskLevel: 'LOW',
        overallScore: 10,
        summary: 'Low risk',
        lockAnalysis: {
          lockMode: 'ROW_EXCLUSIVE',
          blocksReads: false,
          blocksWrites: false,
          estimatedAcquisitionMs: 5,
          recommendedLockTimeoutMs: 5000,
        },
        categoryAssessments: {
          LOCKING: {
            category: 'LOCKING',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          PERFORMANCE: {
            category: 'PERFORMANCE',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          DATA_INTEGRITY: {
            category: 'DATA_INTEGRITY',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          ROLLBACK: {
            category: 'ROLLBACK',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          COMPATIBILITY: {
            category: 'COMPATIBILITY',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
        },
        assessedAt: new Date().toISOString(),
      }
    );
    await sessionRepo.save(session);

    workflowService = new MigrationRehearsalWorkflowService({
      rehearsalDbPort: mockRehearsalDb,
      inspectionPort: mockInspectionPort,
      sandboxPort: mockSandboxPort,
      sessionRepository: sessionRepo,
    });
  });

  it('1. Successfully executes migration rehearsal workflow and captures distinct migrationId and sessionId', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql:
        'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
    });

    expect(evidence.status).toBe('SUCCESS');
    expect(evidence.exitCode).toBe(0);
    expect(evidence.sessionId).toBe(sessionId);
    expect(evidence.migrationId).toBe('mig-test-1');
    expect(evidence.sessionId).not.toBe(evidence.migrationId);
    expect(evidence.statementsSucceeded).toBe(1);
    expect(evidence.statementsFailed).toBe(0);
    expect(evidence.schemaDifferences.hasChanges).toBe(true);
    expect(evidence.schemaDifferences.columns.added).toHaveLength(1);
    expect(evidence.schemaDifferences.columns.added[0].columnName).toBe('rehearsal_marker');
    expect(evidence.rollbackStatus).toBe('DISCARDED');
    expect(evidence.cleanupStatus).toBe('COMPLETED');
  });

  it('2. Fails cleanly when migration SQL contains syntax errors', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockRehearsalDb.executeStatements).mockResolvedValueOnce([
      {
        statementIndex: 0,
        sql: 'ALTER TABLE INVALID SYNTAX;;',
        status: 'FAILED',
        durationMs: 5,
        error: 'syntax error at or near "INVALID"',
      },
    ]);

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'ALTER TABLE INVALID SYNTAX;;',
    });

    expect(evidence.status).toBe('FAILED');
    expect(evidence.exitCode).toBe(1);
    expect(evidence.statementsFailed).toBe(1);
    expect(evidence.failureReason).toContain('syntax error');
    expect(mockRehearsalDb.cleanup).toHaveBeenCalled();
    expect(mockSandboxPort.cleanup).toHaveBeenCalled();
  });

  it('3. Fails when session is not in SANDBOX_READY status and reports clear error message', async () => {
    const draftSession = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-draft',
        name: 'Draft',
        rawSql: 'SELECT 1;',
      },
    });
    await sessionRepo.save(draftSession);

    await expect(
      workflowService.runRehearsal({
        sessionId: draftSession.id,
        migrationSql: 'SELECT 1;',
      })
    ).rejects.toThrow(/is in status 'DRAFT', expected 'SANDBOX_READY' or 'SANDBOX_RUNNING'/);
  });

  it('4. Fails when migration SQL contains no valid statements', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    await expect(
      workflowService.runRehearsal({
        sessionId,
        migrationSql: '   -- Just comments and whitespace\n\n  ',
      })
    ).rejects.toThrow(/contains no executable SQL statements/);
  });

  it('5. Handles duplicate object creation errors during migration execution', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockRehearsalDb.executeStatements).mockResolvedValueOnce([
      {
        statementIndex: 0,
        sql: 'CREATE TABLE public.events (id int);',
        status: 'FAILED',
        durationMs: 5,
        error: 'relation "events" already exists',
      },
    ]);

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'CREATE TABLE public.events (id int);',
    });

    expect(evidence.status).toBe('FAILED');
    expect(evidence.failureReason).toContain('already exists');
  });

  it('6. Handles missing target table errors during migration execution', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockRehearsalDb.executeStatements).mockResolvedValueOnce([
      {
        statementIndex: 0,
        sql: 'ALTER TABLE public.missing_table ADD COLUMN val int;',
        status: 'FAILED',
        durationMs: 5,
        error: 'relation "public.missing_table" does not exist',
      },
    ]);

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'ALTER TABLE public.missing_table ADD COLUMN val int;',
    });

    expect(evidence.status).toBe('FAILED');
    expect(evidence.failureReason).toContain('does not exist');
  });

  it('7. Handles sandbox capability disabled', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockSandboxPort.getCapability).mockResolvedValueOnce({
      enabled: false,
      providerType: 'none',
      status: 'disabled',
      reason: 'Sandbox unavailable on host',
      supportedPlatforms: [],
      currentPlatform: 'win32',
    });

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'ALTER TABLE public.events ADD COLUMN marker int;',
    });

    expect(evidence.status).toBe('FAILED');
    expect(evidence.failureReason).toContain('sandbox capability is disabled');
  });

  it('8. Hard fails rehearsal when sandbox command returns non-zero exit code', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockSandboxPort.execute).mockResolvedValueOnce({
      success: false,
      exitCode: 127,
      stdout: '',
      stderr: 'Command not found in sandbox environment',
      durationMs: 10,
    });

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'ALTER TABLE public.events ADD COLUMN marker int;',
    });

    expect(evidence.status).toBe('FAILED');
    expect(evidence.exitCode).toBe(127);
    expect(evidence.failureReason).toContain('Command not found in sandbox');
    expect(evidence.statementsAttempted).toBe(1);
    expect(evidence.statementsSucceeded).toBe(0);
    expect(mockSandboxPort.cleanup).toHaveBeenCalled();
    expect(mockRehearsalDb.cleanup).toHaveBeenCalled();

    const savedSession = await sessionRepo.findById(sessionId);
    expect(savedSession?.status).toBe('SANDBOX_FAILED');
  });

  it('9. Correctly computes post-migration schema differences', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql:
        'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
    });

    expect(evidence.schemaDifferences.hasChanges).toBe(true);
    expect(evidence.schemaDifferences.summary).toContain(
      'Added column "public.events.rehearsal_marker" (INTEGER NOT NULL DEFAULT 0)'
    );
  });

  it('10. Ensures sandbox workspace cleanup is invoked on success', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    await workflowService.runRehearsal({
      sessionId,
      migrationSql:
        'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
    });

    expect(mockSandboxPort.cleanup).toHaveBeenCalledWith('sb-workspace-999');
  });

  it('11. Ensures rehearsal database cleanup is invoked even on failure', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockRehearsalDb.executeStatements).mockRejectedValueOnce(new Error('Network break'));

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'ALTER TABLE public.events ADD COLUMN marker int;',
    });

    expect(evidence.status).toBe('FAILED');
    expect(mockRehearsalDb.cleanup).toHaveBeenCalled();
  });

  it('12. Leaves original target inspection untouched by migration execution', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    await workflowService.runRehearsal({
      sessionId,
      migrationSql:
        'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
    });

    expect(mockInspectionPort.inspectFullTable).toHaveBeenCalledWith('public', 'events');
  });

  it('13. Transitions session to SANDBOX_REHEARSAL_COMPLETED on success', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    await workflowService.runRehearsal({
      sessionId,
      migrationSql:
        'ALTER TABLE public.events ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;',
    });

    const savedSession = await sessionRepo.findById(sessionId);
    expect(savedSession?.status).toBe('SANDBOX_REHEARSAL_COMPLETED');
    expect(savedSession?.sandboxResult?.status).toBe('SUCCESS');
  });

  it('14. Transitions session to SANDBOX_FAILED on error', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    vi.mocked(mockRehearsalDb.executeStatements).mockResolvedValueOnce([
      {
        statementIndex: 0,
        sql: 'BAD SQL;',
        status: 'FAILED',
        durationMs: 2,
        error: 'Execution error',
      },
    ]);

    await workflowService.runRehearsal({
      sessionId,
      migrationSql: 'BAD SQL;',
    });

    const savedSession = await sessionRepo.findById(sessionId);
    expect(savedSession?.status).toBe('SANDBOX_FAILED');
  });

  it('15. Preserves string literals containing comments and double dashes without corruption', async () => {
    const sessions = await sessionRepo.findAll();
    const sessionId = sessions[0].id;

    const migrationWithLiteral =
      "ALTER TABLE public.events ADD COLUMN marker TEXT DEFAULT 'keep -- intact';";

    const parsedStatement =
      "ALTER TABLE public.events ADD COLUMN marker TEXT DEFAULT 'keep -- intact'";

    vi.mocked(mockRehearsalDb.executeStatements).mockResolvedValueOnce([
      {
        statementIndex: 0,
        sql: parsedStatement,
        status: 'SUCCESS',
        durationMs: 10,
        rowsAffected: 0,
      },
    ]);

    const evidence = await workflowService.runRehearsal({
      sessionId,
      migrationSql: migrationWithLiteral,
    });

    expect(evidence.status).toBe('SUCCESS');
    expect(mockRehearsalDb.executeStatements).toHaveBeenCalledWith(expect.any(String), [
      parsedStatement,
    ]);
  });
});
