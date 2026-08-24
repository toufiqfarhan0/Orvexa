import { describe, it, expect, vi } from 'vitest';
import { PostgresInspectionService } from '../../src/db/services/postgres-inspection.service.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';
import type {
  PostgresServerMetadata,
  SchemaMetadata,
  TableMetadata,
  DatabaseMetadata,
  FullTableInspection,
} from '@orvexa/shared';

describe('PostgresInspectionService (Application Inspection Service Layer)', () => {
  const createMockPort = (): PostgresInspectionPort => ({
    verifyConnectivity: vi.fn().mockResolvedValue({
      connected: true,
      latencyMs: 15,
      database: 'schemasentry_test',
      currentUser: 'postgres',
    }),
    getServerMetadata: vi.fn().mockResolvedValue({
      version: 'PostgreSQL 16.2',
      majorVersion: 16,
      serverEncoding: 'UTF8',
      maxConnections: 100,
      databaseSizeBytes: 5000000,
    } as PostgresServerMetadata),
    getDatabaseMetadata: vi.fn().mockResolvedValue({
      databaseName: 'schemasentry_test',
      currentSchema: 'public',
      server: { version: 'PostgreSQL 16.2', majorVersion: 16, serverEncoding: 'UTF8' },
      schemas: [{ name: 'public', owner: 'postgres' }],
      tables: [],
    } as DatabaseMetadata),
    inspectSchemas: vi
      .fn()
      .mockResolvedValue([
        { name: 'public', owner: 'postgres', tableCount: 5 },
      ] as SchemaMetadata[]),
    inspectTables: vi.fn().mockResolvedValue([
      {
        schemaName: 'public',
        tableName: 'users',
        tableType: 'BASE TABLE',
        estimatedRowCount: 1000,
        totalSizeBytes: 10240,
        tableSizeBytes: 5120,
        indexSizeBytes: 5120,
        isPartitioned: false,
      },
    ] as TableMetadata[]),
    inspectColumns: vi.fn().mockResolvedValue([]),
    inspectConstraints: vi.fn().mockResolvedValue([]),
    inspectIndexes: vi.fn().mockResolvedValue([]),
    getTableStatistics: vi.fn().mockResolvedValue(null),
    getActiveQueries: vi.fn().mockResolvedValue([]),
    getLockInformation: vi.fn().mockResolvedValue([]),
    inspectFullTable: vi.fn().mockResolvedValue({
      table: {
        schemaName: 'public',
        tableName: 'users',
        tableType: 'BASE TABLE',
        estimatedRowCount: 1000,
        totalSizeBytes: 10240,
        tableSizeBytes: 5120,
        indexSizeBytes: 5120,
        isPartitioned: false,
      },
      columns: [],
      foreignKeys: [],
      constraints: [],
      indexes: [],
      statistics: null,
    } as FullTableInspection),
    close: vi.fn().mockResolvedValue(undefined),
  });

  it('delegates verifyTargetDatabase to port', async () => {
    const port = createMockPort();
    const service = new PostgresInspectionService(port);

    const result = await service.verifyTargetDatabase();
    expect(result.connected).toBe(true);
    expect(result.database).toBe('schemasentry_test');
    expect(port.verifyConnectivity).toHaveBeenCalledOnce();
  });

  it('delegates inspectServer to port', async () => {
    const port = createMockPort();
    const service = new PostgresInspectionService(port);

    const server = await service.inspectServer();
    expect(server.majorVersion).toBe(16);
    expect(port.getServerMetadata).toHaveBeenCalledOnce();
  });

  it('delegates inspectDatabase to port', async () => {
    const port = createMockPort();
    const service = new PostgresInspectionService(port);

    const db = await service.inspectDatabase('public');
    expect(db.databaseName).toBe('schemasentry_test');
    expect(port.getDatabaseMetadata).toHaveBeenCalledWith('public');
  });

  it('delegates inspectTable to port', async () => {
    const port = createMockPort();
    const service = new PostgresInspectionService(port);

    const table = await service.inspectTable('public', 'users');
    expect(table.table.tableName).toBe('users');
    expect(port.inspectFullTable).toHaveBeenCalledWith('public', 'users');
  });

  it('delegates close to port', async () => {
    const port = createMockPort();
    const service = new PostgresInspectionService(port);

    await service.close();
    expect(port.close).toHaveBeenCalledOnce();
  });
});
