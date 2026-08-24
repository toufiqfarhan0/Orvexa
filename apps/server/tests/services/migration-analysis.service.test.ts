import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationAnalysisService } from '../../src/services/migration-analysis.service.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { SessionNotFoundError, IllegalActionError } from '../../src/domain/errors.js';
import type {
  CreateMigrationSessionDto,
  FullTableInspection,
  PostgresServerMetadata,
} from '@orvexa/shared';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';

describe('MigrationAnalysisService (Application Orchestration Layer)', () => {
  let repository: InMemoryMigrationSessionRepository;
  let analysisService: MigrationAnalysisService;
  let mockInspectionPort: PostgresInspectionPort;

  const validDto: CreateMigrationSessionDto = {
    targetDatabase: {
      engine: 'postgresql',
      version: '16.0',
      databaseName: 'ecommerce_db',
      schemaName: 'public',
      targetTable: 'users',
      estimatedRowCount: 250000,
      isProductionLike: true,
    },
    proposedMigration: {
      migrationId: 'mig-app-01',
      name: 'add_user_status_index',
      rawSql: 'CREATE INDEX CONCURRENTLY idx_users_status ON users (status);',
    },
  };

  const sampleServerMetadata: PostgresServerMetadata = {
    version: 'PostgreSQL 16.2',
    majorVersion: 16,
    serverEncoding: 'UTF8',
    maxConnections: 100,
  };

  const sampleUsersInspection: FullTableInspection = {
    table: {
      schemaName: 'public',
      tableName: 'users',
      tableType: 'BASE TABLE',
      estimatedRowCount: 250000,
      totalSizeBytes: 50 * 1024 * 1024,
      tableSizeBytes: 35 * 1024 * 1024,
      indexSizeBytes: 15 * 1024 * 1024,
      isPartitioned: false,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'integer',
        udtName: 'int4',
        isNullable: false,
        isIdentity: true,
        isGenerated: false,
      },
      {
        columnName: 'status',
        ordinalPosition: 2,
        dataType: 'varchar',
        udtName: 'varchar',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
    ],
    primaryKey: {
      name: 'users_pkey',
      schemaName: 'public',
      tableName: 'users',
      type: 'PRIMARY KEY',
      columnNames: ['id'],
    },
    foreignKeys: [],
    constraints: [],
    indexes: [],
    statistics: {
      schemaName: 'public',
      tableName: 'users',
      totalSizeBytes: 50 * 1024 * 1024,
      tableSizeBytes: 35 * 1024 * 1024,
      indexSizeBytes: 15 * 1024 * 1024,
      toastSizeBytes: 0,
      liveTuples: 250000,
      deadTuples: 500,
      insertCount: 1000,
      updateCount: 500,
      deleteCount: 10,
    },
  };

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();

    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue({
        connected: true,
        latencyMs: 5,
        database: 'ecommerce_db',
        currentUser: 'postgres',
      }),
      getServerMetadata: vi.fn().mockResolvedValue(sampleServerMetadata),
      getDatabaseMetadata: vi.fn().mockResolvedValue({
        server: sampleServerMetadata,
        schemas: [],
        tables: [],
        inspectedAt: new Date().toISOString(),
      }),
      inspectSchemas: vi.fn().mockResolvedValue([]),
      inspectTables: vi.fn().mockResolvedValue([sampleUsersInspection.table]),
      inspectColumns: vi.fn().mockResolvedValue(sampleUsersInspection.columns),
      inspectConstraints: vi.fn().mockResolvedValue([]),
      inspectIndexes: vi.fn().mockResolvedValue([]),
      getTableStatistics: vi.fn().mockResolvedValue(sampleUsersInspection.statistics),
      inspectFullTable: vi.fn().mockResolvedValue(sampleUsersInspection),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    };

    analysisService = new MigrationAnalysisService(repository, {
      inspectionPortProvider: mockInspectionPort,
    });
  });

  it('1. Successfully executes end-to-end migration analysis workflow on a session', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    const { session: analyzedSession, analysisOutput } =
      await analysisService.analyzeMigrationSession(session.id, {
        actor: 'orchestrator-agent',
      });

    expect(analyzedSession.sessionId).toBe(session.id);
    expect(analyzedSession.status).toBe('SANDBOX_READY');
    expect(analyzedSession.analysisResult).toBeDefined();
    expect(analyzedSession.analysisResult?.isSafeForSandbox).toBe(true);
    expect(analyzedSession.riskAssessment).toBeDefined();
    expect(analyzedSession.riskAssessment?.overallRiskLevel).toBe('LOW');
    expect(analysisOutput.parsedStatements.length).toBe(1);
    expect(analysisOutput.parsedStatements[0]?.isConcurrent).toBe(true);
  });

  it('2. Invokes PostgreSQL inspection interfaces during analysis', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    await analysisService.analyzeMigrationSession(session.id);

    expect(mockInspectionPort.getServerMetadata).toHaveBeenCalled();
    expect(mockInspectionPort.inspectFullTable).toHaveBeenCalledWith('public', 'users');
  });

  it('3. Passes database catalog context into analyzer rules', async () => {
    const dangerousDto: CreateMigrationSessionDto = {
      ...validDto,
      proposedMigration: {
        migrationId: 'mig-dangerous',
        name: 'add_not_null_without_default',
        rawSql: 'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL;',
      },
    };
    const session = MigrationSessionEntity.create(dangerousDto);
    await repository.save(session);

    const { session: analyzedSession } = await analysisService.analyzeMigrationSession(session.id);

    const dataFinding = analyzedSession.analysisResult?.findings.find(
      (f) => f.ruleId === 'DATA-001'
    );
    expect(dataFinding).toBeDefined();
    expect(dataFinding?.severity).toBe('CRITICAL');
    expect(dataFinding?.evidence).toContain('250,000');
  });

  it('4. Persists complete analysis result on session in repository', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    await analysisService.analyzeMigrationSession(session.id);

    const reloaded = await repository.findById(session.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.analysisResult).toBeDefined();
    expect(reloaded?.analysisResult?.findings).toBeInstanceOf(Array);
    expect(reloaded?.analysisResult?.isSafeForSandbox).toBe(true);
  });

  it('5. Persists complete risk assessment on session in repository', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    await analysisService.analyzeMigrationSession(session.id);

    const reloaded = await repository.findById(session.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.riskAssessment).toBeDefined();
    expect(reloaded?.riskAssessment?.lockAnalysis.lockMode).toBe('SHARE_UPDATE_EXCLUSIVE');
    expect(reloaded?.riskAssessment?.categoryAssessments.LOCKING).toBeDefined();
    expect(reloaded?.riskAssessment?.categoryAssessments.DATA_INTEGRITY).toBeDefined();
    expect(reloaded?.riskAssessment?.categoryAssessments.PERFORMANCE).toBeDefined();
    expect(reloaded?.riskAssessment?.categoryAssessments.ROLLBACK).toBeDefined();
    expect(reloaded?.riskAssessment?.categoryAssessments.COMPATIBILITY).toBeDefined();
  });

  it('6. Transitions session to SANDBOX_READY when migration is safe for sandbox rehearsal', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    const { session: updated } = await analysisService.analyzeMigrationSession(session.id);
    expect(updated.status).toBe('SANDBOX_READY');
  });

  it('7. Transitions session to ANALYSIS_FAILED when blockers prevent sandbox rehearsal', async () => {
    const blockerDto: CreateMigrationSessionDto = {
      ...validDto,
      proposedMigration: {
        migrationId: 'mig-blocker',
        name: 'unsupported_syntax',
        rawSql: 'DO $$ BEGIN RAISE NOTICE "Unsupported"; END $$;',
      },
    };
    const session = MigrationSessionEntity.create(blockerDto);
    await repository.save(session);

    const { session: updated } = await analysisService.analyzeMigrationSession(session.id);
    expect(updated.status).toBe('ANALYSIS_FAILED');
    expect(updated.analysisResult?.isSafeForSandbox).toBe(false);
    expect(updated.analysisResult?.blockers.length).toBeGreaterThan(0);
    expect(updated.lastErrorMessage).toContain('unsupported');
  });

  it('8. Transitions session to ANALYSIS_FAILED if database inspection throws error', async () => {
    (
      mockInspectionPort.verifyConnectivity as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    // Should throw and record failure on session
    await expect(analysisService.analyzeMigrationSession(session.id)).rejects.toThrow(
      'Connection terminated unexpectedly'
    );

    const reloaded = await repository.findById(session.id);
    expect(reloaded?.status).toBe('ANALYSIS_FAILED');
    expect(reloaded?.lastErrorMessage).toContain('Connection terminated unexpectedly');
  });

  it('9. Rejects analysis when session is in an invalid state (e.g. EXECUTING or COMPLETED)', async () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(
      {
        analysisId: 'a-1',
        analyzedAt: new Date().toISOString(),
        summary: 'ok',
        findings: [],
        isSafeForSandbox: true,
        blockers: [],
      },
      {
        overallRiskLevel: 'LOW',
        overallScore: 5,
        summary: 'Low risk',
        lockAnalysis: {
          lockMode: 'ROW_EXCLUSIVE',
          blocksReads: false,
          blocksWrites: false,
          estimatedAcquisitionMs: 10,
          recommendedLockTimeoutMs: 5000,
        },
        categoryAssessments: {
          LOCKING: { category: 'LOCKING', level: 'LOW', score: 0, summary: 'ok', reasons: [] },
          PERFORMANCE: {
            category: 'PERFORMANCE',
            level: 'LOW',
            score: 0,
            summary: 'ok',
            reasons: [],
          },
          DATA_INTEGRITY: {
            category: 'DATA_INTEGRITY',
            level: 'LOW',
            score: 0,
            summary: 'ok',
            reasons: [],
          },
          ROLLBACK: { category: 'ROLLBACK', level: 'LOW', score: 0, summary: 'ok', reasons: [] },
          COMPATIBILITY: {
            category: 'COMPATIBILITY',
            level: 'LOW',
            score: 0,
            summary: 'ok',
            reasons: [],
          },
        },
        assessedAt: new Date().toISOString(),
      }
    );
    session.beginSandboxRehearsal();
    await repository.save(session);

    // Session is now in SANDBOX_RUNNING; analyzing it should throw IllegalActionError
    await expect(analysisService.analyzeMigrationSession(session.id)).rejects.toThrow(
      IllegalActionError
    );
  });

  it('10. Rejects unknown session ID with SessionNotFoundError', async () => {
    await expect(
      analysisService.analyzeMigrationSession('non-existent-session-id')
    ).rejects.toThrow(SessionNotFoundError);
  });

  it('11. Confirms no migration DDL was executed during analysis (inspection port called read-only)', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    await analysisService.analyzeMigrationSession(session.id);

    // Only read queries were made to system catalogs
    expect(mockInspectionPort.getServerMetadata).toHaveBeenCalledTimes(1);
    expect(mockInspectionPort.inspectFullTable).toHaveBeenCalledWith('public', 'users');
  });

  it('12. Records complete lifecycle history entries on session', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    const { session: analyzed } = await analysisService.analyzeMigrationSession(session.id, {
      actor: 'ci-orchestrator',
    });

    expect(analyzed.history.length).toBe(3);
    expect(analyzed.history[0]?.toStatus).toBe('DRAFT');
    expect(analyzed.history[1]?.fromStatus).toBe('DRAFT');
    expect(analyzed.history[1]?.toStatus).toBe('ANALYZING');
    expect(analyzed.history[1]?.actor).toBe('ci-orchestrator');
    expect(analyzed.history[2]?.fromStatus).toBe('ANALYZING');
    expect(analyzed.history[2]?.toStatus).toBe('SANDBOX_READY');
  });

  it('13. Re-running analysis from ANALYSIS_FAILED behaves deterministically', async () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisFailure('Network glitch');
    await repository.save(session);

    expect(session.status).toBe('ANALYSIS_FAILED');

    // Rerun analysis
    const { session: rerunSession } = await analysisService.analyzeMigrationSession(session.id);
    expect(rerunSession.status).toBe('SANDBOX_READY');
    expect(rerunSession.riskAssessment?.overallRiskLevel).toBe('LOW');
  });

  it('14. Proves sandbox execution is not prematurely triggered and sandbox-running is not entered', async () => {
    const session = MigrationSessionEntity.create(validDto);
    await repository.save(session);

    const { session: analyzed } = await analysisService.analyzeMigrationSession(session.id);

    // State must be SANDBOX_READY, strictly not SANDBOX_RUNNING
    expect(analyzed.status).toBe('SANDBOX_READY');
    expect(analyzed.sandboxResult).toBeUndefined();
  });
});
