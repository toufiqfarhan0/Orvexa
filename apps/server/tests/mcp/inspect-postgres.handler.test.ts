import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InspectPostgresHandler } from '../../src/mcp/handlers/inspect-postgres.handler.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';
import type { FullTableInspection, PostgresServerMetadata } from '@orvexa/shared';

describe('InspectPostgresHandler (Unit Tests with Mocks)', () => {
  let mockInspectionPort: PostgresInspectionPort;
  let handler: InspectPostgresHandler;

  const mockServerMetadata: PostgresServerMetadata = {
    version: 'PostgreSQL 16.2 on x86_64-apple-darwin23.2.0',
    majorVersion: 16,
    encoding: 'UTF8',
    maxConnections: 100,
  };

  const mockFullTable: FullTableInspection = {
    table: {
      catalogName: 'testdb',
      schemaName: 'public',
      tableName: 'events',
      tableType: 'BASE TABLE',
      rowCountEstimate: 4200,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'uuid',
        isNullable: false,
        columnDefault: 'gen_random_uuid()',
      },
      {
        columnName: 'organization_id',
        ordinalPosition: 2,
        dataType: 'uuid',
        isNullable: false,
      },
      {
        columnName: 'payload',
        ordinalPosition: 3,
        dataType: 'jsonb',
        isNullable: true,
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
    foreignKeys: [
      {
        name: 'fk_events_org',
        schemaName: 'public',
        tableName: 'events',
        type: 'FOREIGN KEY',
        columnNames: ['organization_id'],
        foreignSchemaName: 'public',
        foreignTableName: 'organizations',
        foreignColumnNames: ['id'],
        isDeferrable: false,
      },
    ],
    indexes: [
      {
        schemaName: 'public',
        tableName: 'events',
        indexName: 'events_pkey',
        isUnique: true,
        isPrimary: true,
        isClustered: false,
        isValid: true,
        indexType: 'btree',
        columnNames: ['id'],
        indexDefinition: 'CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id)',
        sizeBytes: 16384,
      },
      {
        schemaName: 'public',
        tableName: 'events',
        indexName: 'idx_events_org_id',
        isUnique: false,
        isPrimary: false,
        isClustered: false,
        isValid: true,
        indexType: 'btree',
        columnNames: ['organization_id'],
        indexDefinition:
          'CREATE INDEX idx_events_org_id ON public.events USING btree (organization_id)',
        sizeBytes: 8192,
      },
    ],
    statistics: {
      schemaName: 'public',
      tableName: 'events',
      totalSizeBytes: 155648,
      tableSizeBytes: 131072,
      indexSizeBytes: 24576,
      toastSizeBytes: 0,
      liveTuples: 4200,
      deadTuples: 10,
      insertCount: 4200,
      updateCount: 50,
      deleteCount: 10,
    },
  };

  beforeEach(() => {
    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue({
        connected: true,
        database: 'testdb',
        user: 'postgres',
        latencyMs: 5,
      }),
      getServerMetadata: vi.fn().mockResolvedValue(mockServerMetadata),
      inspectSchemas: vi.fn().mockResolvedValue([{ schemaName: 'public' }]),
      inspectTables: vi.fn().mockResolvedValue([mockFullTable.table]),
      inspectColumns: vi.fn().mockResolvedValue(mockFullTable.columns),
      inspectConstraints: vi.fn().mockResolvedValue([]),
      inspectIndexes: vi.fn().mockResolvedValue(mockFullTable.indexes),
      getTableStatistics: vi.fn().mockResolvedValue(mockFullTable.statistics),
      inspectFullTable: vi.fn().mockResolvedValue(mockFullTable),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    };

    handler = new InspectPostgresHandler(mockInspectionPort);
  });

  it('1. Successfully executes valid inspect_postgres_target request', async () => {
    const result = await handler.handle({
      schema: 'public',
      table: 'events',
    });

    expect(result.target).toEqual({
      database: 'postgres',
      schema: 'public',
      table: 'events',
    });
    expect(result.serverMetadata.majorVersion).toBe(16);
    expect(result.tableDetails.estimatedRowCount).toBe(4200);
    expect(result.tableDetails.columns).toHaveLength(3);
    expect(result.tableDetails.primaryKey?.name).toBe('events_pkey');
    expect(result.tableDetails.foreignKeys).toHaveLength(1);
    expect(result.tableDetails.indexes).toHaveLength(2);
    expect(result.activitySummary).toEqual({
      activeQueriesCount: 0,
      activeLocksCount: 0,
    });
    expect(result.inspectedAt).toBeDefined();
  });

  it('2. Defaults schema to public when omitted', async () => {
    await handler.handle({ table: 'events' });
    expect(mockInspectionPort.inspectFullTable).toHaveBeenCalledWith('public', 'events');
  });

  it('3. Rejects invalid table identifier with special characters (SQL injection protection)', async () => {
    await expect(handler.handle({ table: 'events; DROP TABLE users;--' })).rejects.toThrow(
      /Invalid table identifier/
    );

    expect(mockInspectionPort.inspectFullTable).not.toHaveBeenCalled();
  });

  it('4. Rejects invalid schema identifier', async () => {
    await expect(handler.handle({ schema: 'bad schema!', table: 'events' })).rejects.toThrow(
      /Invalid schema identifier/
    );

    expect(mockInspectionPort.inspectFullTable).not.toHaveBeenCalled();
  });

  it('5. Rejects missing table argument', async () => {
    await expect(handler.handle({})).rejects.toThrow(/Missing required parameter: "table"/);
    await expect(handler.handle({ table: '' })).rejects.toThrow(
      /Missing required parameter: "table"/
    );
  });

  it('6. Rejects non-object raw input', async () => {
    await expect(handler.handle(null)).rejects.toThrow(/Input must be a valid JSON object/);
    await expect(handler.handle('string')).rejects.toThrow(/Input must be a valid JSON object/);
    await expect(handler.handle(123)).rejects.toThrow(/Input must be a valid JSON object/);
  });

  it('7. Handles database connection failure safely without exposing credentials', async () => {
    vi.mocked(mockInspectionPort.getServerMetadata).mockRejectedValue(
      new Error(
        'connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused'
      )
    );

    await expect(handler.handle({ table: 'events' })).rejects.toThrow(
      /connection to server at "localhost"/
    );
  });

  it('8. Handles table inspection not found error', async () => {
    vi.mocked(mockInspectionPort.inspectFullTable).mockRejectedValue(
      new Error('Table "nonexistent" not found in schema "public"')
    );

    await expect(handler.handle({ table: 'nonexistent' })).rejects.toThrow(
      /Table "nonexistent" not found/
    );
  });

  it('9. Correctly includes lock activity when active locks exist', async () => {
    vi.mocked(mockInspectionPort.getLockInformation).mockResolvedValue([
      {
        lockType: 'relation',
        relation: 'events',
        mode: 'AccessShareLock',
        granted: true,
        pid: 1234,
      },
    ]);

    const result = await handler.handle({ table: 'events' });
    expect(result.activitySummary.activeLocksCount).toBe(1);
  });

  it('10. Asserts output contains zero password or connection string attributes', async () => {
    const result = await handler.handle({ table: 'events' });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('postgresql://');
  });
});
