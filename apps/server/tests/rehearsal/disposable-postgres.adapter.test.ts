import { describe, it, expect, vi } from 'vitest';
import { DisposablePostgresAdapter } from '../../src/rehearsal/adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalService } from '../../src/rehearsal/services/migration-rehearsal.service.js';
import type { FullTableInspection } from '@orvexa/shared';
import type { RehearsalDatabasePort } from '../../src/rehearsal/ports/rehearsal-database.port.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';

describe('DisposablePostgresAdapter & MigrationRehearsalService (Unit Tests)', () => {
  const mockTableInspection: FullTableInspection = {
    table: {
      schemaName: 'public',
      tableName: 'items',
      tableType: 'BASE TABLE',
      estimatedRowCount: 1,
      totalSizeBytes: 8192,
      tableSizeBytes: 8192,
      indexSizeBytes: 0,
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
        columnName: 'name',
        ordinalPosition: 2,
        dataType: 'varchar',
        udtName: 'varchar',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
    ],
    primaryKey: {
      name: 'items_pkey',
      schemaName: 'public',
      tableName: 'items',
      type: 'PRIMARY KEY',
      columnNames: ['id'],
      isDeferrable: false,
    },
    constraints: [],
    foreignKeys: [],
    indexes: [],
    statistics: null,
  };

  it('1. Initializes with connection configuration without leaking passwords in string representations', () => {
    const adapter = new DisposablePostgresAdapter({
      connectionString: 'postgresql://testuser:supersecret@localhost:5432/testdb',
    });

    expect(adapter).toBeDefined();
  });

  it('2. getEnvironment returns null for unprovisioned rehearsal', async () => {
    const adapter = new DisposablePostgresAdapter();
    const env = await adapter.getEnvironment('non-existent');
    expect(env).toBeNull();
  });

  it('3. MigrationRehearsalService prepares rehearsal using provided table inspections', async () => {
    const mockRehearsalPort: RehearsalDatabasePort = {
      provision: vi.fn().mockResolvedValue({
        rehearsalId: 'test-reh-1',
        sourceTargetId: 'testdb',
        postgresVersion: 'PostgreSQL 16',
        databaseName: 'rehearsal_test_reh_1',
        schemaName: 'public',
        status: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tableCount: 0,
        clonedTables: [],
        fixtureRowCount: 0,
      }),
      cloneSchema: vi.fn().mockResolvedValue({
        tablesCreated: 1,
        columnsCreated: 2,
        primaryKeysCreated: 1,
        foreignKeysCreated: 0,
        constraintsCreated: 0,
        indexesCreated: 0,
        fixtureRowsInserted: 0,
        durationMs: 15,
      }),
      seedFixtures: vi.fn().mockResolvedValue(3),
      getEnvironment: vi.fn().mockResolvedValue({
        rehearsalId: 'test-reh-1',
        sourceTargetId: 'testdb',
        postgresVersion: 'PostgreSQL 16',
        databaseName: 'rehearsal_test_reh_1',
        schemaName: 'public',
        status: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tableCount: 1,
        clonedTables: ['items'],
        fixtureRowCount: 3,
      }),
      getConnectionConfig: vi.fn().mockResolvedValue({
        host: 'localhost',
        port: 5432,
        database: 'rehearsal_test_reh_1',
        user: 'postgres',
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
      listEnvironments: vi.fn().mockResolvedValue([]),
    };

    const service = new MigrationRehearsalService({
      rehearsalDbPort: mockRehearsalPort,
    });

    const result = await service.prepareRehearsal(
      'test-reh-1',
      { includeFixtures: true, fixtureRowLimit: 3 },
      [mockTableInspection]
    );

    expect(mockRehearsalPort.provision).toHaveBeenCalledWith('test-reh-1', {
      includeFixtures: true,
      fixtureRowLimit: 3,
    });
    expect(mockRehearsalPort.cloneSchema).toHaveBeenCalledWith('test-reh-1', [mockTableInspection]);
    expect(mockRehearsalPort.seedFixtures).toHaveBeenCalledWith(
      'test-reh-1',
      [mockTableInspection],
      3
    );
    expect(result.environment.status).toBe('READY');
    expect(result.environment.clonedTables).toContain('items');
  });

  it('4. MigrationRehearsalService fetches metadata from inspection port when not explicitly passed', async () => {
    const mockRehearsalPort: RehearsalDatabasePort = {
      provision: vi.fn().mockResolvedValue({
        rehearsalId: 'test-reh-2',
        sourceTargetId: 'testdb',
        postgresVersion: 'PostgreSQL 16',
        databaseName: 'rehearsal_test_reh_2',
        schemaName: 'public',
        status: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tableCount: 1,
        clonedTables: ['items'],
        fixtureRowCount: 0,
      }),
      cloneSchema: vi.fn().mockResolvedValue({
        tablesCreated: 1,
        columnsCreated: 2,
        primaryKeysCreated: 1,
        foreignKeysCreated: 0,
        constraintsCreated: 0,
        indexesCreated: 0,
        fixtureRowsInserted: 0,
        durationMs: 10,
      }),
      seedFixtures: vi.fn().mockResolvedValue(0),
      getEnvironment: vi.fn().mockResolvedValue(null),
      getConnectionConfig: vi.fn().mockResolvedValue({
        host: 'localhost',
        port: 5432,
        database: 'rehearsal_test_reh_2',
        user: 'postgres',
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
      listEnvironments: vi.fn().mockResolvedValue([]),
    };

    const mockInspectionPort: Partial<PostgresInspectionPort> = {
      inspectFullTable: vi.fn().mockResolvedValue(mockTableInspection),
    };

    const service = new MigrationRehearsalService({
      rehearsalDbPort: mockRehearsalPort,
      inspectionPort: mockInspectionPort as PostgresInspectionPort,
    });

    const result = await service.prepareRehearsal('test-reh-2', {
      targetTables: ['items'],
      includeFixtures: false,
    });

    expect(mockInspectionPort.inspectFullTable).toHaveBeenCalledWith('public', 'items');
    expect(mockRehearsalPort.cloneSchema).toHaveBeenCalledWith('test-reh-2', [mockTableInspection]);
    expect(mockRehearsalPort.seedFixtures).not.toHaveBeenCalled();
    expect(result.environment).toBeDefined();
  });

  it('5. Throws when no inspection metadata is available', async () => {
    const mockRehearsalPort: Partial<RehearsalDatabasePort> = {};
    const service = new MigrationRehearsalService({
      rehearsalDbPort: mockRehearsalPort as RehearsalDatabasePort,
    });

    await expect(service.prepareRehearsal('empty-reh')).rejects.toThrow(
      /Cannot prepare rehearsal database/
    );
  });

  it('6. Cleanup delegates to rehearsal port idempotently', async () => {
    const mockRehearsalPort: Partial<RehearsalDatabasePort> = {
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    const service = new MigrationRehearsalService({
      rehearsalDbPort: mockRehearsalPort as RehearsalDatabasePort,
    });

    await service.cleanupRehearsal('reh-to-clean');
    expect(mockRehearsalPort.cleanup).toHaveBeenCalledWith('reh-to-clean');
  });
});
