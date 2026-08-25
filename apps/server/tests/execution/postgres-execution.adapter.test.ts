import { describe, it, expect, vi } from 'vitest';
import { PostgresExecutionAdapter } from '../../src/execution/adapters/postgres-execution.adapter.js';
import type pg from 'pg';

describe('PostgresExecutionAdapter (Unit Tests with Boundary Mocks)', () => {
  const createMockPool = (
    queryMock: (sql: string) => Promise<{ rows?: unknown[]; command?: string; rowCount?: number }>
  ) => {
    const client = {
      query: vi.fn(queryMock),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as pg.Pool;

    return { pool, client };
  };

  it('1. Verifies connectivity and returns latency for valid target', async () => {
    const { pool } = createMockPool(async (sql) => {
      if (sql.includes('SELECT 1')) return { rows: [{ health_check: 1 }] };
      return { rows: [] };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.verifyTargetConnectivity({
      engine: 'postgresql',
      databaseName: 'testdb',
      schemaName: 'public',
      isProductionLike: false,
    });

    expect(result.connected).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('2. Rejects connectivity check when schemaName is an invalid identifier', async () => {
    const { pool } = createMockPool(async () => {
      return { rows: [] };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.verifyTargetConnectivity({
      engine: 'postgresql',
      databaseName: 'testdb',
      schemaName: 'public; DROP TABLE users; --',
      isProductionLike: false,
    });

    expect(result.connected).toBe(false);
    expect(result.error).toContain('Invalid target schema identifier');
  });

  it('3. Sets properly quoted search_path for valid custom schema', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'OK', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'tenant_staging_01',
        isProductionLike: false,
      },
      ['ALTER TABLE users ADD COLUMN age int;']
    );

    expect(result.success).toBe(true);
    expect(executedSqls).toContain('SET search_path TO "tenant_staging_01", public;');
  });

  it('4. Rejects execution and runs zero queries when target schema identifier is invalid or contains injection', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'OK', rowCount: 0 };
    });

    const invalidSchemas = [
      'public; DROP TABLE users; --',
      'schema"with"quote',
      'invalid schema with spaces',
      '123_starts_with_digit',
      'schema$injection; SELECT 1;',
    ];

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });

    for (const badSchema of invalidSchemas) {
      executedSqls.length = 0;
      const result = await adapter.executeApprovedMigration(
        {
          engine: 'postgresql',
          databaseName: 'testdb',
          schemaName: badSchema,
          isProductionLike: false,
        },
        ['ALTER TABLE users ADD COLUMN age int;']
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_SCHEMA_IDENTIFIER');
      expect(result.errorMessage).toContain('Invalid target schema identifier');
      expect(executedSqls).toHaveLength(0); // Zero database queries executed
    }
  });

  it('5. Rejects DML migrations fail-closed with UNSUPPORTED_DML and executes zero queries', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'OK', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ["INSERT INTO users (name) VALUES ('Alice');"]
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED_DML');
    expect(result.errorMessage).toContain('Data manipulation language (DML');
    expect(executedSqls).toHaveLength(0); // Zero database queries executed
  });

  it('6. Executes transactional DDL inside BEGIN...COMMIT block', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'ALTER TABLE', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ['ALTER TABLE users ADD COLUMN age int;']
    );

    expect(result.success).toBe(true);
    expect(result.statementsExecuted).toBe(1);
    expect(executedSqls).toContain('BEGIN;');
    expect(executedSqls).toContain('ALTER TABLE users ADD COLUMN age int;');
    expect(executedSqls).toContain('COMMIT;');
  });

  it('7. Rolls back transaction on statement failure and reports error', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      if (sql.includes('ADD COLUMN bad_col')) {
        const err = new Error('column "bad_col" already exists');
        Object.assign(err, { code: '42701' });
        throw err;
      }
      return { command: 'OK', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ['ALTER TABLE users ADD COLUMN bad_col int;']
    );

    expect(result.success).toBe(false);
    expect(result.statementsFailed).toBe(1);
    expect(result.errorCode).toBe('42701');
    expect(executedSqls).toContain('BEGIN;');
    expect(executedSqls).toContain('ROLLBACK;');
  });

  it('8. Executes CREATE INDEX CONCURRENTLY outside BEGIN/COMMIT block', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'CREATE INDEX', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ['CREATE INDEX CONCURRENTLY idx_users_email ON users (email);']
    );

    expect(result.success).toBe(true);
    expect(executedSqls).not.toContain('BEGIN;');
    expect(executedSqls).not.toContain('COMMIT;');
    expect(executedSqls).toContain('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
  });

  it('9. Executes VACUUM outside BEGIN/COMMIT block', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'VACUUM', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ['VACUUM ANALYZE users;']
    );

    expect(result.success).toBe(true);
    expect(executedSqls).not.toContain('BEGIN;');
    expect(executedSqls).not.toContain('COMMIT;');
    expect(executedSqls).toContain('VACUUM ANALYZE users;');
  });

  it('10. Rejects unsupported or manual transaction statements fail-closed before execution', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'OK', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      ['BEGIN;']
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED_STATEMENT');
    expect(result.errorMessage).toContain('Manual transaction control');
    expect(executedSqls).toHaveLength(0); // Zero database queries executed
  });

  it('11. Multi-statement execution with mixed non-transactional statements does not cross transaction boundaries', async () => {
    const executedSqls: string[] = [];
    const { pool } = createMockPool(async (sql) => {
      executedSqls.push(sql);
      return { command: 'OK', rowCount: 0 };
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.executeApprovedMigration(
      {
        engine: 'postgresql',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      [
        'ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;',
        'CREATE INDEX CONCURRENTLY idx_users_active ON users (is_active);',
      ]
    );

    expect(result.success).toBe(true);
    expect(result.statementsExecuted).toBe(2);
    expect(executedSqls).not.toContain('BEGIN;');
    expect(executedSqls).not.toContain('COMMIT;');
    expect(executedSqls).toContain('ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;');
    expect(executedSqls).toContain(
      'CREATE INDEX CONCURRENTLY idx_users_active ON users (is_active);'
    );
  });

  it('12. Strips sensitive credentials from connection errors', async () => {
    const { pool } = createMockPool(async () => {
      throw new Error(
        'password authentication failed for user "postgres" with connection postgresql://postgres:supersecret@10.0.0.1:5432/db'
      );
    });

    const adapter = new PostgresExecutionAdapter({ injectedPool: pool });
    const result = await adapter.verifyTargetConnectivity({
      engine: 'postgresql',
      databaseName: 'db',
      schemaName: 'public',
      isProductionLike: false,
    });

    expect(result.connected).toBe(false);
    expect(result.error).not.toContain('supersecret');
    expect(result.error).toContain('***');
  });
});
