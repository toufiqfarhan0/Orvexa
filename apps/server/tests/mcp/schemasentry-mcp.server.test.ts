import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaSentryMcpServer } from '../../src/mcp/schemasentry-mcp.server.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';
import type { FullTableInspection, PostgresServerMetadata } from '@orvexa/shared';

describe('SchemaSentryMcpServer (Unit Tests)', () => {
  let mockInspectionPort: PostgresInspectionPort;
  let mcpServer: SchemaSentryMcpServer;

  const mockServerMetadata: PostgresServerMetadata = {
    version: 'PostgreSQL 16.2',
    majorVersion: 16,
    encoding: 'UTF8',
    maxConnections: 100,
  };

  const mockFullTable: FullTableInspection = {
    table: {
      catalogName: 'testdb',
      schemaName: 'public',
      tableName: 'orders',
      tableType: 'BASE TABLE',
      rowCountEstimate: 1500,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'uuid',
        isNullable: false,
      },
    ],
    primaryKey: {
      name: 'orders_pkey',
      schemaName: 'public',
      tableName: 'orders',
      type: 'PRIMARY KEY',
      columnNames: ['id'],
      isDeferrable: false,
    },
    foreignKeys: [],
    indexes: [],
    statistics: {
      schemaName: 'public',
      tableName: 'orders',
      totalSizeBytes: 65536,
      tableSizeBytes: 65536,
      indexSizeBytes: 0,
      toastSizeBytes: 0,
      liveTuples: 1500,
      deadTuples: 0,
      insertCount: 1500,
      updateCount: 0,
      deleteCount: 0,
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
      inspectIndexes: vi.fn().mockResolvedValue([]),
      getTableStatistics: vi.fn().mockResolvedValue(mockFullTable.statistics),
      inspectFullTable: vi.fn().mockResolvedValue(mockFullTable),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mcpServer = new SchemaSentryMcpServer({
      inspectionPort: mockInspectionPort,
    });
  });

  it('1. Initializes server and creates Express router', () => {
    const router = mcpServer.createRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('2. Exposes direct handler for testing inspection queries', async () => {
    const handler = mcpServer.getHandler();
    const result = await handler.handle({ schema: 'public', table: 'orders' });

    expect(result.target.table).toBe('orders');
    expect(result.tableDetails.estimatedRowCount).toBe(1500);
    expect(result.tableDetails.primaryKey?.name).toBe('orders_pkey');
  });

  it('3. Encapsulates error handling for invalid tool parameters', async () => {
    const handler = mcpServer.getHandler();
    await expect(handler.handle({ table: 'orders; DROP TABLE users;' })).rejects.toThrow(
      /Invalid table identifier/
    );
  });
});
