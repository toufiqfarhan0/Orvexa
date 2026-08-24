import type {
  PostgresServerMetadata,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  ConstraintMetadata,
  IndexMetadata,
  TableStatistics,
  ActiveQuery,
  LockInformation,
  DatabaseMetadata,
  FullTableInspection,
} from '@orvexa/shared';

/**
 * Port interface for PostgreSQL database inspection.
 * Decouples the application layer from specific database client drivers.
 */
export interface PostgresInspectionPort {
  /**
   * Verifies database connectivity and measures round-trip ping latency.
   */
  verifyConnectivity(): Promise<{
    connected: boolean;
    latencyMs: number;
    database: string;
    currentUser: string;
  }>;

  /**
   * Retrieves server engine version, system identifier, and encoding.
   */
  getServerMetadata(): Promise<PostgresServerMetadata>;

  /**
   * Retrieves aggregated database metadata including schemas and tables.
   */
  getDatabaseMetadata(targetSchema?: string): Promise<DatabaseMetadata>;

  /**
   * Lists all non-system schemas in the database.
   */
  inspectSchemas(): Promise<SchemaMetadata[]>;

  /**
   * Lists tables within a specific schema or across all user schemas.
   */
  inspectTables(schemaName?: string): Promise<TableMetadata[]>;

  /**
   * Retrieves column definitions for a specific table.
   */
  inspectColumns(schemaName: string, tableName: string): Promise<ColumnMetadata[]>;

  /**
   * Retrieves primary key, foreign key, unique, and check constraints for a table.
   */
  inspectConstraints(schemaName: string, tableName: string): Promise<ConstraintMetadata[]>;

  /**
   * Retrieves index definitions, uniqueness, and sizes for a table.
   */
  inspectIndexes(schemaName: string, tableName: string): Promise<IndexMetadata[]>;

  /**
   * Retrieves table size breakdown and tuple/vacuum statistics.
   */
  getTableStatistics(schemaName: string, tableName: string): Promise<TableStatistics | null>;

  /**
   * Retrieves currently active backend queries and transactions.
   */
  getActiveQueries(): Promise<ActiveQuery[]>;

  /**
   * Retrieves live lock information from pg_locks and pg_stat_activity.
   */
  getLockInformation(schemaName?: string, tableName?: string): Promise<LockInformation[]>;

  /**
   * Performs a consolidated inspection of a table (columns, constraints, indexes, stats).
   */
  inspectFullTable(schemaName: string, tableName: string): Promise<FullTableInspection>;

  /**
   * Closes underlying connection pool resources gracefully.
   */
  close(): Promise<void>;
}
