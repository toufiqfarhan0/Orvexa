/**
 * Server and engine level metadata for a target PostgreSQL instance.
 */
export interface PostgresServerMetadata {
  version: string;
  majorVersion: number;
  systemIdentifier?: string;
  maxConnections?: number;
  isSuperuser?: boolean;
  serverEncoding: string;
  databaseSizeBytes?: number;
}

/**
 * PostgreSQL schema metadata.
 */
export interface SchemaMetadata {
  name: string;
  owner: string;
  tableCount?: number;
}

/**
 * Table level metadata and physical characteristics.
 */
export interface TableMetadata {
  schemaName: string;
  tableName: string;
  tableType: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW' | 'FOREIGN TABLE';
  estimatedRowCount: number;
  totalSizeBytes: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  isPartitioned: boolean;
}

/**
 * Column definition metadata.
 */
export interface ColumnMetadata {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault?: string;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
  isIdentity: boolean;
  isGenerated: boolean;
}

/**
 * Supported PostgreSQL constraint types.
 */
export type ConstraintType =
  'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'EXCLUSION' | 'OTHER';

/**
 * Table constraint metadata (Primary Key, Foreign Key, Unique, Check).
 */
export interface ConstraintMetadata {
  name: string;
  schemaName: string;
  tableName: string;
  type: ConstraintType;
  columnNames: string[];
  foreignSchemaName?: string;
  foreignTableName?: string;
  foreignColumnNames?: string[];
  onUpdate?: string;
  onDelete?: string;
  checkClause?: string;
  isDeferrable: boolean;
}

/**
 * Table index metadata.
 */
export interface IndexMetadata {
  indexName: string;
  schemaName: string;
  tableName: string;
  isUnique: boolean;
  isPrimary: boolean;
  isClustered: boolean;
  isValid: boolean;
  indexType: 'btree' | 'hash' | 'gist' | 'gin' | 'spgist' | 'brin' | string;
  columnNames: string[];
  indexDefinition: string;
  sizeBytes: number;
}

/**
 * Table activity, size breakdown, and vacuum/analyze statistics.
 */
export interface TableStatistics {
  schemaName: string;
  tableName: string;
  totalSizeBytes: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  toastSizeBytes: number;
  liveTuples: number;
  deadTuples: number;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  lastVacuum?: string;
  lastAutovacuum?: string;
  lastAnalyze?: string;
  lastAutoanalyze?: string;
}

/**
 * Currently active backend session or executing query.
 */
export interface ActiveQuery {
  pid: number;
  databaseName: string;
  username: string;
  clientAddress?: string;
  applicationName?: string;
  state: string;
  queryStartedAt?: string;
  queryDurationMs?: number;
  query: string;
  waitingOnLock: boolean;
  waitEventType?: string;
  waitEvent?: string;
}

/**
 * Live lock information retrieved from PostgreSQL system views.
 */
export interface LockInformation {
  lockType: string;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  mode: string;
  granted: boolean;
  pid: number;
  applicationName?: string;
  query?: string;
  fastpath: boolean;
  blockingPid?: number;
}

/**
 * Aggregated database-level metadata payload.
 */
export interface DatabaseMetadata {
  databaseName: string;
  currentSchema: string;
  server: PostgresServerMetadata;
  schemas: SchemaMetadata[];
  tables: TableMetadata[];
}

/**
 * Consolidated inspection report for a single table.
 */
export interface FullTableInspection {
  table: TableMetadata;
  columns: ColumnMetadata[];
  primaryKey?: ConstraintMetadata;
  foreignKeys: ConstraintMetadata[];
  constraints: ConstraintMetadata[];
  indexes: IndexMetadata[];
  statistics: TableStatistics | null;
}

/**
 * Live schema overview for a target table used in the Database Tables Inspector.
 */
export interface TargetTableInspection {
  tableName: string;
  tableType: string;
  estimatedRowCount: number;
  totalSizeBytes: number;
  tableSizeBytes?: number;
  indexSizeBytes?: number;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  constraints: ConstraintMetadata[];
}

/**
 * API response format for GET /api/migrations/target/tables
 */
export interface TargetDatabaseSchemaResponse {
  database: string;
  schema: string;
  tables: TargetTableInspection[];
}
