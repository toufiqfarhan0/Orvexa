import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import { PgInspectionAdapter } from '../../src/db/adapters/pg-inspection.adapter.js';
import { PostgresInspectionService } from '../../src/db/services/postgres-inspection.service.js';

// Helper to check if local PostgreSQL port is reachable
function isPostgresReachable(host = 'localhost', port = 5432, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

describe('PostgreSQL Live Integration Test Suite (Real PostgreSQL)', () => {
  let adapter: PgInspectionAdapter;
  let service: PostgresInspectionService;

  beforeAll(async () => {
    const dbUrl =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

    const url = new URL(dbUrl);
    const host = url.hostname || 'localhost';
    const port = parseInt(url.port || '5432', 10);

    const reachable = await isPostgresReachable(host, port, 2000);
    if (!reachable) {
      throw new Error(
        `[PostgreSQL Integration] Unable to reach PostgreSQL database at ${host}:${port}.\n` +
          `Ensure the local Docker PostgreSQL container is running before executing integration tests:\n` +
          `  docker compose up -d\n` +
          `  or npm run docker:db:up`
      );
    }

    adapter = new PgInspectionAdapter({
      connectionString: dbUrl,
    });
    service = new PostgresInspectionService(adapter);

    // Explicitly verify connection handshake before running test suite
    const connectivity = await service.verifyTargetDatabase();
    if (!connectivity.connected) {
      throw new Error(`[PostgreSQL Integration] Database connected check failed for ${dbUrl}`);
    }
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.close();
    }
  });

  it('1. Verifies database connectivity and round-trip ping', async () => {
    const connectivity = await service.verifyTargetDatabase();
    expect(connectivity.connected).toBe(true);
    expect(connectivity.database).toBe('schemasentry_test');
    expect(connectivity.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('2. Retrieves real PostgreSQL server metadata', async () => {
    const server = await service.inspectServer();
    expect(server.majorVersion).toBeGreaterThanOrEqual(14);
    expect(server.serverEncoding).toBe('UTF8');
    expect(server.maxConnections).toBeGreaterThan(0);
    expect(server.databaseSizeBytes).toBeGreaterThan(0);
  });

  it('3. Inspects non-system schemas', async () => {
    const schemas = await service.inspectSchemas();
    expect(schemas.length).toBeGreaterThan(0);
    const publicSchema = schemas.find((s) => s.name === 'public');
    expect(publicSchema).toBeDefined();
    expect(publicSchema?.tableCount).toBeGreaterThanOrEqual(4);
  });

  it('4. Lists tables in public schema', async () => {
    const tables = await service.inspectTables('public');
    expect(tables.length).toBeGreaterThanOrEqual(4);
    const names = tables.map((t) => t.tableName);
    expect(names).toContain('organizations');
    expect(names).toContain('users');
    expect(names).toContain('orders');
    expect(names).toContain('events');
  });

  it('5. Inspects column definitions for users table', async () => {
    const columns = await adapter.inspectColumns('public', 'users');
    expect(columns.length).toBeGreaterThanOrEqual(5);

    const email = columns.find((c) => c.columnName === 'email');
    expect(email?.dataType).toBe('character varying');
    expect(email?.characterMaximumLength).toBe(255);
    expect(email?.isNullable).toBe(false);

    const orgId = columns.find((c) => c.columnName === 'organization_id');
    expect(orgId?.dataType).toBe('uuid');
    expect(orgId?.isNullable).toBe(false);
  });

  it('6. Inspects primary keys, foreign keys, and constraints', async () => {
    const constraints = await adapter.inspectConstraints('public', 'users');
    const pk = constraints.find((c) => c.type === 'PRIMARY KEY');
    expect(pk?.columnNames).toEqual(['id']);

    const fk = constraints.find((c) => c.type === 'FOREIGN KEY');
    expect(fk?.foreignTableName).toBe('organizations');
    expect(fk?.onDelete).toBe('CASCADE');

    const check = constraints.find((c) => c.type === 'CHECK');
    expect(check).toBeDefined();
  });

  it('7. Inspects index definitions and sizes', async () => {
    const indexes = await adapter.inspectIndexes('public', 'users');
    expect(indexes.length).toBeGreaterThanOrEqual(1);

    const orgIndex = indexes.find((i) => i.indexName === 'idx_users_org_id');
    expect(orgIndex?.isUnique).toBe(false);
    expect(orgIndex?.columnNames).toEqual(['organization_id']);
  });

  it('8. Retrieves real table statistics and vacuum records', async () => {
    const stats = await adapter.getTableStatistics('public', 'users');
    expect(stats).not.toBeNull();
    expect(stats?.tableName).toBe('users');
    expect(stats?.totalSizeBytes).toBeGreaterThan(0);
    expect(stats?.tableSizeBytes).toBeGreaterThan(0);
  });

  it('9. Inspects active queries and sessions', async () => {
    const queries = await service.inspectActiveQueries();
    expect(queries).toBeInstanceOf(Array);
  });

  it('10. Inspects PostgreSQL lock tables', async () => {
    const locks = await service.inspectLocks('public', 'users');
    expect(locks).toBeInstanceOf(Array);
  });

  it('11. Performs consolidated full table inspection', async () => {
    const full = await service.inspectTable('public', 'orders');
    expect(full.table.tableName).toBe('orders');
    expect(full.columns.length).toBeGreaterThan(0);
    expect(full.primaryKey).toBeDefined();
    expect(full.primaryKey?.columnNames).toContain('id');
    expect(full.foreignKeys.length).toBeGreaterThanOrEqual(2);
    expect(full.indexes.length).toBeGreaterThanOrEqual(2);
  });
});
