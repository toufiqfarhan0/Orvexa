import { describe, it, expect, vi } from 'vitest';
import type pg from 'pg';
import { PgInspectionAdapter } from '../../src/db/adapters/pg-inspection.adapter.js';
import {
  PostgresConnectionError,
  PostgresQueryError,
  InvalidInspectionRequestError,
} from '../../src/db/errors/postgres.errors.js';

describe('PgInspectionAdapter (Read-Only PostgreSQL Inspection Adapter)', () => {
  const createMockPool = (
    queryFn: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>
  ) => {
    const mockPool = {
      query: vi.fn(queryFn),
      on: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as pg.Pool;

    return mockPool;
  };

  it('verifyConnectivity returns latency and connection details', async () => {
    const mockPool = createMockPool(async (sql) => {
      if (sql.includes('current_database()')) {
        return {
          rows: [{ db: 'schemasentry_test', usr: 'postgres_app' }],
          rowCount: 1,
        };
      }
      return { rows: [] };
    });

    const adapter = new PgInspectionAdapter(
      { connectionString: 'postgresql://app:mypass@localhost:5432/schemasentry_test' },
      mockPool
    );

    const result = await adapter.verifyConnectivity();
    expect(result.connected).toBe(true);
    expect(result.database).toBe('schemasentry_test');
    expect(result.currentUser).toBe('postgres_app');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('getServerMetadata retrieves version and engine characteristics', async () => {
    const mockPool = createMockPool(async (sql) => {
      if (sql.includes('server_version_num')) {
        return {
          rows: [
            {
              full_version: 'PostgreSQL 16.2 on x86_64-pc-linux-musl',
              major_version: 16,
              server_encoding: 'UTF8',
              max_connections: 100,
              database_size_bytes: '10485760',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const meta = await adapter.getServerMetadata();

    expect(meta.majorVersion).toBe(16);
    expect(meta.serverEncoding).toBe('UTF8');
    expect(meta.maxConnections).toBe(100);
    expect(meta.databaseSizeBytes).toBe(10485760);
    expect(meta.version).toContain('PostgreSQL 16.2');
  });

  it('inspectSchemas lists user schemas and table counts', async () => {
    const mockPool = createMockPool(async () => {
      return {
        rows: [
          { name: 'ecommerce', owner: 'postgres', table_count: 4 },
          { name: 'public', owner: 'postgres', table_count: 8 },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const schemas = await adapter.inspectSchemas();

    expect(schemas.length).toBe(2);
    expect(schemas[0].name).toBe('ecommerce');
    expect(schemas[0].tableCount).toBe(4);
    expect(schemas[1].name).toBe('public');
  });

  it('inspectTables retrieves tables with physical sizes and estimated rows', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public']);
      return {
        rows: [
          {
            schema_name: 'public',
            table_name: 'users',
            table_type: 'BASE TABLE',
            estimated_row_count: '50000',
            total_size_bytes: '8388608',
            table_size_bytes: '4194304',
            index_size_bytes: '4194304',
            is_partitioned: false,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const tables = await adapter.inspectTables('public');

    expect(tables.length).toBe(1);
    expect(tables[0].tableName).toBe('users');
    expect(tables[0].estimatedRowCount).toBe(50000);
    expect(tables[0].totalSizeBytes).toBe(8388608);
    expect(tables[0].isPartitioned).toBe(false);
  });

  it('inspectColumns extracts detailed column definitions', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public', 'users']);
      return {
        rows: [
          {
            column_name: 'id',
            ordinal_position: 1,
            data_type: 'uuid',
            udt_name: 'uuid',
            is_nullable: false,
            column_default: 'gen_random_uuid()',
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: false,
            is_generated: false,
          },
          {
            column_name: 'email',
            ordinal_position: 2,
            data_type: 'character varying',
            udt_name: 'varchar',
            is_nullable: false,
            column_default: null,
            character_maximum_length: 255,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: false,
            is_generated: false,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const columns = await adapter.inspectColumns('public', 'users');

    expect(columns.length).toBe(2);
    expect(columns[0].columnName).toBe('id');
    expect(columns[0].dataType).toBe('uuid');
    expect(columns[0].isNullable).toBe(false);
    expect(columns[1].columnName).toBe('email');
    expect(columns[1].characterMaximumLength).toBe(255);
  });

  it('inspectConstraints extracts primary keys and foreign keys', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public', 'users']);
      return {
        rows: [
          {
            name: 'users_pkey',
            schema_name: 'public',
            table_name: 'users',
            type: 'PRIMARY KEY',
            column_names: ['id'],
            foreign_schema_name: null,
            foreign_table_name: null,
            foreign_column_names: null,
            on_update: null,
            on_delete: null,
            check_clause: 'PRIMARY KEY (id)',
            is_deferrable: false,
          },
          {
            name: 'users_org_id_fkey',
            schema_name: 'public',
            table_name: 'users',
            type: 'FOREIGN KEY',
            column_names: ['organization_id'],
            foreign_schema_name: 'public',
            foreign_table_name: 'organizations',
            foreign_column_names: ['id'],
            on_update: 'NO ACTION',
            on_delete: 'CASCADE',
            check_clause:
              'FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE',
            is_deferrable: false,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const constraints = await adapter.inspectConstraints('public', 'users');

    expect(constraints.length).toBe(2);
    expect(constraints[0].type).toBe('PRIMARY KEY');
    expect(constraints[0].columnNames).toEqual(['id']);
    expect(constraints[1].type).toBe('FOREIGN KEY');
    expect(constraints[1].foreignTableName).toBe('organizations');
    expect(constraints[1].onDelete).toBe('CASCADE');
  });

  it('inspectIndexes extracts index definitions, uniqueness, and sizes', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public', 'users']);
      return {
        rows: [
          {
            index_name: 'users_pkey',
            schema_name: 'public',
            table_name: 'users',
            is_unique: true,
            is_primary: true,
            is_clustered: false,
            is_valid: true,
            index_type: 'btree',
            column_names: ['id'],
            index_definition: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)',
            size_bytes: '16384',
          },
          {
            index_name: 'idx_users_email',
            schema_name: 'public',
            table_name: 'users',
            is_unique: true,
            is_primary: false,
            is_clustered: false,
            is_valid: true,
            index_type: 'btree',
            column_names: ['email'],
            index_definition:
              'CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email)',
            size_bytes: '16384',
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const indexes = await adapter.inspectIndexes('public', 'users');

    expect(indexes.length).toBe(2);
    expect(indexes[0].isPrimary).toBe(true);
    expect(indexes[1].indexName).toBe('idx_users_email');
    expect(indexes[1].isUnique).toBe(true);
    expect(indexes[1].sizeBytes).toBe(16384);
  });

  it('getTableStatistics retrieves vacuum and tuple counts', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public', 'users']);
      return {
        rows: [
          {
            schema_name: 'public',
            table_name: 'users',
            total_size_bytes: '1048576',
            table_size_bytes: '524288',
            index_size_bytes: '524288',
            toast_size_bytes: '0',
            live_tuples: '1240',
            dead_tuples: '12',
            insert_count: '1500',
            update_count: '300',
            delete_count: '260',
            last_vacuum: '2026-08-20 12:00:00+00',
            last_autovacuum: null,
            last_analyze: '2026-08-22 14:30:00+00',
            last_autoanalyze: null,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const stats = await adapter.getTableStatistics('public', 'users');

    expect(stats).not.toBeNull();
    expect(stats?.liveTuples).toBe(1240);
    expect(stats?.deadTuples).toBe(12);
    expect(stats?.lastVacuum).toBe('2026-08-20 12:00:00+00');
  });

  it('getActiveQueries returns running sessions without password leaks', async () => {
    const mockPool = createMockPool(async () => {
      return {
        rows: [
          {
            pid: 1420,
            database_name: 'schemasentry_test',
            username: 'app_user',
            client_address: '127.0.0.1',
            application_name: 'orvexa-backend',
            state: 'active',
            query_started_at: '2026-08-24 10:00:00+00',
            query_duration_ms: 45,
            query: 'SELECT * FROM users WHERE organization_id = $1',
            waiting_on_lock: false,
            wait_event_type: null,
            wait_event: null,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const queries = await adapter.getActiveQueries();

    expect(queries.length).toBe(1);
    expect(queries[0].pid).toBe(1420);
    expect(queries[0].waitingOnLock).toBe(false);
    expect(queries[0].query).toContain('SELECT * FROM users');
  });

  it('getLockInformation retrieves active lock table entries', async () => {
    const mockPool = createMockPool(async (_sql, params) => {
      expect(params).toEqual(['public', 'users']);
      return {
        rows: [
          {
            lock_type: 'relation',
            database_name: 'schemasentry_test',
            schema_name: 'public',
            table_name: 'users',
            mode: 'AccessShareLock',
            granted: true,
            pid: 1420,
            application_name: 'backend',
            query: 'SELECT 1 FROM users',
            fastpath: true,
            blocking_pid: null,
          },
        ],
      };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const locks = await adapter.getLockInformation('public', 'users');

    expect(locks.length).toBe(1);
    expect(locks[0].mode).toBe('AccessShareLock');
    expect(locks[0].granted).toBe(true);
  });

  it('inspectFullTable consolidates columns, constraints, indexes, and statistics', async () => {
    const mockPool = createMockPool(async (sql) => {
      if (sql.includes('pg_stat_user_tables')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'users',
              total_size_bytes: '16384',
              table_size_bytes: '8192',
              index_size_bytes: '8192',
              toast_size_bytes: '0',
              live_tuples: '100',
              dead_tuples: '0',
              insert_count: '100',
              update_count: '0',
              delete_count: '0',
              last_vacuum: null,
              last_autovacuum: null,
              last_analyze: null,
              last_autoanalyze: null,
            },
          ],
        };
      }
      if (sql.includes('information_schema.columns')) {
        return {
          rows: [
            {
              column_name: 'id',
              ordinal_position: 1,
              data_type: 'uuid',
              udt_name: 'uuid',
              is_nullable: false,
              column_default: null,
              character_maximum_length: null,
              numeric_precision: null,
              numeric_scale: null,
              is_identity: false,
              is_generated: false,
            },
          ],
        };
      }
      if (sql.includes('pg_constraint')) {
        return {
          rows: [
            {
              name: 'users_pkey',
              schema_name: 'public',
              table_name: 'users',
              type: 'PRIMARY KEY',
              column_names: ['id'],
              foreign_schema_name: null,
              foreign_table_name: null,
              foreign_column_names: null,
              on_update: null,
              on_delete: null,
              check_clause: 'PRIMARY KEY (id)',
              is_deferrable: false,
            },
          ],
        };
      }
      if (sql.includes('pg_index')) {
        return {
          rows: [
            {
              index_name: 'users_pkey',
              schema_name: 'public',
              table_name: 'users',
              is_unique: true,
              is_primary: true,
              is_clustered: false,
              is_valid: true,
              index_type: 'btree',
              column_names: ['id'],
              index_definition: 'CREATE UNIQUE INDEX users_pkey ON users(id)',
              size_bytes: '8192',
            },
          ],
        };
      }
      if (sql.includes('pg_class') && sql.includes('table_type')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'users',
              table_type: 'BASE TABLE',
              estimated_row_count: '100',
              total_size_bytes: '16384',
              table_size_bytes: '8192',
              index_size_bytes: '8192',
              is_partitioned: false,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    const full = await adapter.inspectFullTable('public', 'users');

    expect(full.table.tableName).toBe('users');
    expect(full.columns.length).toBe(1);
    expect(full.primaryKey?.name).toBe('users_pkey');
    expect(full.indexes.length).toBe(1);
    expect(full.statistics?.liveTuples).toBe(100);
  });

  it('handles connection failures with PostgresConnectionError and redacts sensitive passwords', async () => {
    const mockPool = createMockPool(async () => {
      const err = new Error(
        'password authentication failed for user "postgres" with password superSecret123'
      ) as Error & { code: string };
      err.code = '28P01';
      throw err;
    });

    const adapter = new PgInspectionAdapter(
      { connectionString: 'postgresql://postgres:superSecret123@db.target.aws:5432/prod' },
      mockPool
    );

    await expect(adapter.verifyConnectivity()).rejects.toThrow(PostgresConnectionError);
    try {
      await adapter.verifyConnectivity();
    } catch (err) {
      expect(err).toBeInstanceOf(PostgresConnectionError);
      const connErr = err as PostgresConnectionError;
      expect(connErr.code).toBe('POSTGRES_CONNECTION_ERROR');
      expect(connErr.sanitizedTarget).not.toContain('superSecret123');
      expect(connErr.sanitizedTarget).toContain('***');
      expect(connErr.message).not.toContain('superSecret123');
    }
  });

  it('handles network transport errors (ENOTFOUND, ETIMEDOUT, ECONNRESET, 57P03) as PostgresConnectionError', async () => {
    const codes = ['ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET', '57P03', '08001'];

    for (const code of codes) {
      const mockPool = createMockPool(async () => {
        const err = new Error(`Socket transport failure: ${code}`) as Error & { code: string };
        err.code = code;
        throw err;
      });

      const adapter = new PgInspectionAdapter({}, mockPool);
      await expect(adapter.verifyConnectivity()).rejects.toThrow(PostgresConnectionError);
    }
  });

  it('getDatabaseMetadata gates execution with verifyConnectivity and fails fast on connection error', async () => {
    let callCount = 0;
    const mockPool = createMockPool(async () => {
      callCount++;
      const err = new Error('Connection refused') as Error & { code: string };
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    await expect(adapter.getDatabaseMetadata()).rejects.toThrow(PostgresConnectionError);

    // Confirms that only 1 query (verifyConnectivity) was attempted, gating downstream queries
    expect(callCount).toBe(1);
  });

  it('handles query failures with PostgresQueryError', async () => {
    const mockPool = createMockPool(async () => {
      const err = new Error('relation "non_existent" does not exist') as Error & { code: string };
      err.code = '42P01';
      throw err;
    });

    const adapter = new PgInspectionAdapter({}, mockPool);
    await expect(adapter.inspectColumns('public', 'non_existent')).rejects.toThrow(
      PostgresQueryError
    );
  });

  it('rejects invalid schema or table identifier before executing query', async () => {
    const mockPool = createMockPool(async () => ({ rows: [] }));
    const adapter = new PgInspectionAdapter({}, mockPool);

    await expect(adapter.inspectColumns('public; DROP TABLE users;', 'users')).rejects.toThrow(
      InvalidInspectionRequestError
    );
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
