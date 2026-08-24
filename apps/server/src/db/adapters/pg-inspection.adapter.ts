import pg from 'pg';
import type {
  PostgresServerMetadata,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  ConstraintMetadata,
  ConstraintType,
  IndexMetadata,
  TableStatistics,
  ActiveQuery,
  LockInformation,
  DatabaseMetadata,
  FullTableInspection,
} from '@orvexa/shared';
import type { PostgresInspectionPort } from '../ports/postgres-inspection.port.js';
import { PostgresConnectionError, PostgresQueryError } from '../errors/postgres.errors.js';
import {
  sanitizeConnectionString,
  sanitizeErrorMessage,
  validateIdentifier,
  parsePgArray,
} from '../utils/sanitizer.js';

const { Pool } = pg;

export interface PgAdapterConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | object;
  maxConnections?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

/**
 * Production-grade read-only PostgreSQL Inspection Adapter.
 * Queries PostgreSQL catalog and information_schema views without modifying any data.
 */
export class PgInspectionAdapter implements PostgresInspectionPort {
  private readonly pool: pg.Pool;
  private readonly sanitizedConnectionTarget: string;

  constructor(config: PgAdapterConfig = {}, injectedPool?: pg.Pool) {
    const connectionString =
      config.connectionString ||
      process.env.DATABASE_URL ||
      `postgresql://${config.user || 'postgres'}:${config.password || 'postgres'}@${config.host || 'localhost'}:${config.port || 5432}/${config.database || 'postgres'}`;

    this.sanitizedConnectionTarget = sanitizeConnectionString(connectionString);

    this.pool =
      injectedPool ||
      new Pool({
        connectionString,
        max: config.maxConnections ?? 10,
        connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
        idleTimeoutMillis: config.idleTimeoutMillis ?? 10000,
        ssl: config.ssl ?? false,
        statement_timeout: config.statementTimeoutMillis ?? 15000,
      });

    this.pool.on('error', (err) => {
      // Log sanitized error without credentials
      console.error(
        '[PgInspectionAdapter] Unexpected background pool error:',
        sanitizeErrorMessage(err.message)
      );
    });
  }

  /**
   * Internal query wrapper enforcing query parameterization, structured logging, and sanitized errors.
   */
  private async executeQuery<T extends pg.QueryResultRow>(
    operation: string,
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const startTime = performance.now();
    try {
      const result = await this.pool.query<T>(sql, params);
      const durationMs = Math.round(performance.now() - startTime);
      console.info(
        `[PgInspectionAdapter] ${operation} completed in ${durationMs}ms (${result.rowCount ?? 0} rows)`
      );
      return result.rows;
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const rawError = err as Error & { code?: string };
      const sanitizedMsg = sanitizeErrorMessage(rawError.message);
      console.error(
        `[PgInspectionAdapter] ${operation} failed after ${durationMs}ms: ${sanitizedMsg}`
      );

      if (
        rawError.code === 'ECONNREFUSED' ||
        rawError.code === '28P01' ||
        rawError.code === '3D000'
      ) {
        throw new PostgresConnectionError(
          `Failed to connect to PostgreSQL at ${this.sanitizedConnectionTarget}: ${sanitizedMsg}`,
          this.sanitizedConnectionTarget,
          rawError.code
        );
      }

      throw new PostgresQueryError(
        `PostgreSQL inspection query failed during '${operation}': ${sanitizedMsg}`,
        operation,
        rawError.code
      );
    }
  }

  public async verifyConnectivity(): Promise<{
    connected: boolean;
    latencyMs: number;
    database: string;
    currentUser: string;
  }> {
    const startTime = performance.now();
    interface PingRow {
      db: string;
      usr: string;
    }
    const rows = await this.executeQuery<PingRow>(
      'verifyConnectivity',
      'SELECT current_database() as db, current_user as usr;'
    );
    const latencyMs = Math.round(performance.now() - startTime);

    if (rows.length === 0) {
      throw new PostgresConnectionError(
        'Database ping returned empty result set.',
        this.sanitizedConnectionTarget
      );
    }

    return {
      connected: true,
      latencyMs,
      database: rows[0].db,
      currentUser: rows[0].usr,
    };
  }

  public async getServerMetadata(): Promise<PostgresServerMetadata> {
    interface ServerRow {
      full_version: string;
      major_version: number;
      server_encoding: string;
      max_connections: number;
      database_size_bytes: string | number;
    }

    const sql = `
      SELECT
        version() as full_version,
        (current_setting('server_version_num')::integer / 10000) as major_version,
        current_setting('server_encoding') as server_encoding,
        current_setting('max_connections')::integer as max_connections,
        pg_database_size(current_database()) as database_size_bytes;
    `;

    const rows = await this.executeQuery<ServerRow>('getServerMetadata', sql);
    const row = rows[0];

    if (!row) {
      throw new PostgresQueryError(
        'Failed to retrieve PostgreSQL server metadata (empty result set).',
        'getServerMetadata'
      );
    }

    return {
      version: row.full_version,
      majorVersion: Number(row.major_version),
      serverEncoding: row.server_encoding,
      maxConnections: Number(row.max_connections),
      databaseSizeBytes: Number(row.database_size_bytes),
    };
  }

  public async inspectSchemas(): Promise<SchemaMetadata[]> {
    interface SchemaRow {
      name: string;
      owner: string;
      table_count: number;
    }

    const sql = `
      SELECT
        n.nspname as name,
        r.rolname as owner,
        count(c.oid)::integer as table_count
      FROM pg_namespace n
      JOIN pg_roles r ON n.nspowner = r.oid
      LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r', 'v', 'm', 'p')
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
      GROUP BY n.nspname, r.rolname
      ORDER BY n.nspname;
    `;

    const rows = await this.executeQuery<SchemaRow>('inspectSchemas', sql);
    return rows.map((r) => ({
      name: r.name,
      owner: r.owner,
      tableCount: Number(r.table_count),
    }));
  }

  public async inspectTables(schemaName?: string): Promise<TableMetadata[]> {
    if (schemaName) {
      validateIdentifier(schemaName, 'schemaName');
    }

    interface TableRow {
      schema_name: string;
      table_name: string;
      table_type: string;
      estimated_row_count: string | number;
      total_size_bytes: string | number;
      table_size_bytes: string | number;
      index_size_bytes: string | number;
      is_partitioned: boolean;
    }

    const sql = `
      SELECT
        n.nspname as schema_name,
        c.relname as table_name,
        CASE c.relkind
          WHEN 'r' THEN 'BASE TABLE'
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
          WHEN 'f' THEN 'FOREIGN TABLE'
          ELSE 'BASE TABLE'
        END as table_type,
        GREATEST(c.reltuples, 0)::bigint as estimated_row_count,
        pg_total_relation_size(c.oid) as total_size_bytes,
        pg_relation_size(c.oid) as table_size_bytes,
        pg_indexes_size(c.oid) as index_size_bytes,
        (c.relkind = 'p' OR c.relispartition = true) as is_partitioned
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'v', 'm', 'f', 'p')
        AND n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
        AND ($1::text IS NULL OR n.nspname = $1)
      ORDER BY n.nspname, c.relname;
    `;

    const rows = await this.executeQuery<TableRow>('inspectTables', sql, [schemaName || null]);
    return rows.map((r) => ({
      schemaName: r.schema_name,
      tableName: r.table_name,
      tableType: r.table_type as TableMetadata['tableType'],
      estimatedRowCount: Number(r.estimated_row_count),
      totalSizeBytes: Number(r.total_size_bytes),
      tableSizeBytes: Number(r.table_size_bytes),
      indexSizeBytes: Number(r.index_size_bytes),
      isPartitioned: Boolean(r.is_partitioned),
    }));
  }

  public async inspectColumns(schemaName: string, tableName: string): Promise<ColumnMetadata[]> {
    validateIdentifier(schemaName, 'schemaName');
    validateIdentifier(tableName, 'tableName');

    interface ColumnRow {
      column_name: string;
      ordinal_position: number;
      data_type: string;
      udt_name: string;
      is_nullable: boolean;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_identity: boolean;
      is_generated: boolean;
    }

    const sql = `
      SELECT
        column_name,
        ordinal_position::integer,
        data_type,
        udt_name,
        (is_nullable = 'YES') as is_nullable,
        column_default,
        character_maximum_length::integer,
        numeric_precision::integer,
        numeric_scale::integer,
        (is_identity = 'YES') as is_identity,
        (is_generated != 'NEVER') as is_generated
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const rows = await this.executeQuery<ColumnRow>('inspectColumns', sql, [schemaName, tableName]);
    return rows.map((r) => ({
      columnName: r.column_name,
      ordinalPosition: Number(r.ordinal_position),
      dataType: r.data_type,
      udtName: r.udt_name,
      isNullable: Boolean(r.is_nullable),
      columnDefault: r.column_default ?? undefined,
      characterMaximumLength:
        r.character_maximum_length !== null ? Number(r.character_maximum_length) : undefined,
      numericPrecision: r.numeric_precision !== null ? Number(r.numeric_precision) : undefined,
      numericScale: r.numeric_scale !== null ? Number(r.numeric_scale) : undefined,
      isIdentity: Boolean(r.is_identity),
      isGenerated: Boolean(r.is_generated),
    }));
  }

  public async inspectConstraints(
    schemaName: string,
    tableName: string
  ): Promise<ConstraintMetadata[]> {
    validateIdentifier(schemaName, 'schemaName');
    validateIdentifier(tableName, 'tableName');

    interface ConstraintRow {
      name: string;
      schema_name: string;
      table_name: string;
      type: string;
      column_names: string[];
      foreign_schema_name: string | null;
      foreign_table_name: string | null;
      foreign_column_names: string[] | null;
      on_update: string | null;
      on_delete: string | null;
      check_clause: string | null;
      is_deferrable: boolean;
    }

    const sql = `
      SELECT
        con.conname as name,
        n.nspname as schema_name,
        c.relname as table_name,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'c' THEN 'CHECK'
          WHEN 'x' THEN 'EXCLUSION'
          ELSE 'OTHER'
        END as type,
        ARRAY(
          SELECT a.attname
          FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attnum = k.attnum AND a.attrelid = con.conrelid
          ORDER BY k.ord
        ) as column_names,
        fn.nspname as foreign_schema_name,
        fc.relname as foreign_table_name,
        ARRAY(
          SELECT fa.attname
          FROM unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord)
          JOIN pg_attribute fa ON fa.attnum = fk.attnum AND fa.attrelid = con.confrelid
          ORDER BY fk.ord
        ) as foreign_column_names,
        CASE con.confupdtype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
          ELSE NULL
        END as on_update,
        CASE con.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
          ELSE NULL
        END as on_delete,
        pg_get_constraintdef(con.oid) as check_clause,
        con.condeferrable as is_deferrable
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_class fc ON fc.oid = con.confrelid
      LEFT JOIN pg_namespace fn ON fn.oid = fc.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2
      ORDER BY con.contype, con.conname;
    `;

    const rows = await this.executeQuery<ConstraintRow>('inspectConstraints', sql, [
      schemaName,
      tableName,
    ]);
    return rows.map((r) => {
      const colNames = parsePgArray(r.column_names);
      const foreignColNames = parsePgArray(r.foreign_column_names);

      return {
        name: r.name,
        schemaName: r.schema_name,
        tableName: r.table_name,
        type: r.type as ConstraintType,
        columnNames: colNames,
        foreignSchemaName: r.foreign_schema_name ?? undefined,
        foreignTableName: r.foreign_table_name ?? undefined,
        foreignColumnNames: foreignColNames.length > 0 ? foreignColNames : undefined,
        onUpdate: r.on_update ?? undefined,
        onDelete: r.on_delete ?? undefined,
        checkClause: r.check_clause ?? undefined,
        isDeferrable: Boolean(r.is_deferrable),
      };
    });
  }

  public async inspectIndexes(schemaName: string, tableName: string): Promise<IndexMetadata[]> {
    validateIdentifier(schemaName, 'schemaName');
    validateIdentifier(tableName, 'tableName');

    interface IndexRow {
      index_name: string;
      schema_name: string;
      table_name: string;
      is_unique: boolean;
      is_primary: boolean;
      is_clustered: boolean;
      is_valid: boolean;
      index_type: string;
      column_names: string[] | string;
      index_definition: string;
      size_bytes: string | number;
    }

    const sql = `
      SELECT
        i.relname as index_name,
        n.nspname as schema_name,
        t.relname as table_name,
        idx.indisunique as is_unique,
        idx.indisprimary as is_primary,
        idx.indisclustered as is_clustered,
        idx.indisvalid as is_valid,
        am.amname as index_type,
        ARRAY(
          SELECT a.attname
          FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attnum = k.attnum AND a.attrelid = t.oid
          ORDER BY k.ord
        ) as column_names,
        pg_get_indexdef(i.oid) as index_definition,
        pg_relation_size(i.oid) as size_bytes
      FROM pg_index idx
      JOIN pg_class i ON i.oid = idx.indexrelid
      JOIN pg_class t ON t.oid = idx.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      WHERE n.nspname = $1 AND t.relname = $2
      ORDER BY idx.indisprimary DESC, i.relname;
    `;

    const rows = await this.executeQuery<IndexRow>('inspectIndexes', sql, [schemaName, tableName]);
    return rows.map((r) => ({
      indexName: r.index_name,
      schemaName: r.schema_name,
      tableName: r.table_name,
      isUnique: Boolean(r.is_unique),
      isPrimary: Boolean(r.is_primary),
      isClustered: Boolean(r.is_clustered),
      isValid: Boolean(r.is_valid),
      indexType: r.index_type,
      columnNames: parsePgArray(r.column_names),
      indexDefinition: r.index_definition,
      sizeBytes: Number(r.size_bytes),
    }));
  }

  public async getTableStatistics(
    schemaName: string,
    tableName: string
  ): Promise<TableStatistics | null> {
    validateIdentifier(schemaName, 'schemaName');
    validateIdentifier(tableName, 'tableName');

    interface StatRow {
      schema_name: string;
      table_name: string;
      total_size_bytes: string | number;
      table_size_bytes: string | number;
      index_size_bytes: string | number;
      toast_size_bytes: string | number;
      live_tuples: string | number;
      dead_tuples: string | number;
      insert_count: string | number;
      update_count: string | number;
      delete_count: string | number;
      last_vacuum: string | null;
      last_autovacuum: string | null;
      last_analyze: string | null;
      last_autoanalyze: string | null;
    }

    const sql = `
      SELECT
        n.nspname as schema_name,
        c.relname as table_name,
        pg_total_relation_size(c.oid) as total_size_bytes,
        pg_relation_size(c.oid) as table_size_bytes,
        pg_indexes_size(c.oid) as index_size_bytes,
        COALESCE(pg_total_relation_size(c.reltoastrelid), 0) as toast_size_bytes,
        COALESCE(s.n_live_tup, 0)::bigint as live_tuples,
        COALESCE(s.n_dead_tup, 0)::bigint as dead_tuples,
        COALESCE(s.n_tup_ins, 0)::bigint as insert_count,
        COALESCE(s.n_tup_upd, 0)::bigint as update_count,
        COALESCE(s.n_tup_del, 0)::bigint as delete_count,
        s.last_vacuum::text as last_vacuum,
        s.last_autovacuum::text as last_autovacuum,
        s.last_analyze::text as last_analyze,
        s.last_autoanalyze::text as last_autoanalyze
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.schemaname = n.nspname AND s.relname = c.relname
      WHERE n.nspname = $1 AND c.relname = $2;
    `;

    const rows = await this.executeQuery<StatRow>('getTableStatistics', sql, [
      schemaName,
      tableName,
    ]);
    if (rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      schemaName: r.schema_name,
      tableName: r.table_name,
      totalSizeBytes: Number(r.total_size_bytes),
      tableSizeBytes: Number(r.table_size_bytes),
      indexSizeBytes: Number(r.index_size_bytes),
      toastSizeBytes: Number(r.toast_size_bytes),
      liveTuples: Number(r.live_tuples),
      deadTuples: Number(r.dead_tuples),
      insertCount: Number(r.insert_count),
      updateCount: Number(r.update_count),
      deleteCount: Number(r.delete_count),
      lastVacuum: r.last_vacuum ?? undefined,
      lastAutovacuum: r.last_autovacuum ?? undefined,
      lastAnalyze: r.last_analyze ?? undefined,
      lastAutoanalyze: r.last_autoanalyze ?? undefined,
    };
  }

  public async getActiveQueries(): Promise<ActiveQuery[]> {
    interface QueryRow {
      pid: number;
      database_name: string;
      username: string;
      client_address: string | null;
      application_name: string | null;
      state: string;
      query_started_at: string | null;
      query_duration_ms: number | null;
      query: string;
      waiting_on_lock: boolean;
      wait_event_type: string | null;
      wait_event: string | null;
    }

    const sql = `
      SELECT
        pid::integer,
        datname as database_name,
        usename as username,
        client_addr::text as client_address,
        application_name,
        state,
        query_start::text as query_started_at,
        EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as query_duration_ms,
        query,
        (wait_event_type IS NOT NULL) as waiting_on_lock,
        wait_event_type,
        wait_event
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
        AND state != 'idle'
      ORDER BY query_start DESC NULLS LAST
      LIMIT 100;
    `;

    const rows = await this.executeQuery<QueryRow>('getActiveQueries', sql);
    return rows.map((r) => ({
      pid: Number(r.pid),
      databaseName: r.database_name || '',
      username: r.username || '',
      clientAddress: r.client_address ?? undefined,
      applicationName: r.application_name ?? undefined,
      state: r.state,
      queryStartedAt: r.query_started_at ?? undefined,
      queryDurationMs:
        r.query_duration_ms !== null ? Math.round(Number(r.query_duration_ms)) : undefined,
      query: r.query,
      waitingOnLock: Boolean(r.waiting_on_lock),
      waitEventType: r.wait_event_type ?? undefined,
      waitEvent: r.wait_event ?? undefined,
    }));
  }

  public async getLockInformation(
    schemaName?: string,
    tableName?: string
  ): Promise<LockInformation[]> {
    if (schemaName) validateIdentifier(schemaName, 'schemaName');
    if (tableName) validateIdentifier(tableName, 'tableName');

    interface LockRow {
      lock_type: string;
      database_name: string | null;
      schema_name: string | null;
      table_name: string | null;
      mode: string;
      granted: boolean;
      pid: number;
      application_name: string | null;
      query: string | null;
      fastpath: boolean;
      blocking_pid: number | null;
    }

    const sql = `
      SELECT
        l.locktype as lock_type,
        d.datname as database_name,
        n.nspname as schema_name,
        c.relname as table_name,
        l.mode,
        l.granted,
        l.pid::integer,
        a.application_name,
        a.query,
        l.fastpath,
        (SELECT bl.pid::integer FROM pg_locks bl WHERE bl.locktype = l.locktype AND bl.granted AND bl.pid != l.pid LIMIT 1) as blocking_pid
      FROM pg_locks l
      LEFT JOIN pg_database d ON d.oid = l.database
      LEFT JOIN pg_class c ON c.oid = l.relation
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE ($1::text IS NULL OR n.nspname = $1)
        AND ($2::text IS NULL OR c.relname = $2)
      ORDER BY l.granted ASC, l.pid ASC
      LIMIT 200;
    `;

    const rows = await this.executeQuery<LockRow>('getLockInformation', sql, [
      schemaName || null,
      tableName || null,
    ]);

    return rows.map((r) => ({
      lockType: r.lock_type,
      databaseName: r.database_name ?? undefined,
      schemaName: r.schema_name ?? undefined,
      tableName: r.table_name ?? undefined,
      mode: r.mode,
      granted: Boolean(r.granted),
      pid: Number(r.pid),
      applicationName: r.application_name ?? undefined,
      query: r.query ?? undefined,
      fastpath: Boolean(r.fastpath),
      blockingPid: r.blocking_pid !== null ? Number(r.blocking_pid) : undefined,
    }));
  }

  public async getDatabaseMetadata(targetSchema?: string): Promise<DatabaseMetadata> {
    const [server, schemas, tables, connectivity] = await Promise.all([
      this.getServerMetadata(),
      this.inspectSchemas(),
      this.inspectTables(targetSchema),
      this.verifyConnectivity(),
    ]);

    return {
      databaseName: connectivity.database,
      currentSchema: targetSchema || 'public',
      server,
      schemas,
      tables,
    };
  }

  public async inspectFullTable(
    schemaName: string,
    tableName: string
  ): Promise<FullTableInspection> {
    validateIdentifier(schemaName, 'schemaName');
    validateIdentifier(tableName, 'tableName');

    const [tables, columns, constraints, indexes, statistics] = await Promise.all([
      this.inspectTables(schemaName),
      this.inspectColumns(schemaName, tableName),
      this.inspectConstraints(schemaName, tableName),
      this.inspectIndexes(schemaName, tableName),
      this.getTableStatistics(schemaName, tableName),
    ]);

    const targetTable = tables.find((t) => t.tableName === tableName);
    if (!targetTable) {
      throw new PostgresQueryError(
        `Table '${schemaName}.${tableName}' was not found during full inspection.`,
        'inspectFullTable'
      );
    }

    const primaryKey = constraints.find((c) => c.type === 'PRIMARY KEY');
    const foreignKeys = constraints.filter((c) => c.type === 'FOREIGN KEY');

    return {
      table: targetTable,
      columns,
      primaryKey,
      foreignKeys,
      constraints,
      indexes,
      statistics,
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
