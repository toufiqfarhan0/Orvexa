/**
 * Common DDL and schema migration operation categories.
 */
export type MigrationOperationType =
  | 'ADD_COLUMN'
  | 'DROP_COLUMN'
  | 'RENAME_COLUMN'
  | 'ALTER_COLUMN_TYPE'
  | 'SET_NOT_NULL'
  | 'DROP_NOT_NULL'
  | 'ADD_INDEX'
  | 'DROP_INDEX'
  | 'ADD_FOREIGN_KEY'
  | 'ADD_CHECK_CONSTRAINT'
  | 'ADD_PRIMARY_KEY'
  | 'DROP_CONSTRAINT'
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'RENAME_TABLE'
  | 'TRUNCATE_TABLE'
  | 'CUSTOM_DDL'
  | 'UNSUPPORTED_OPERATION';

/**
 * Metadata describing the target database environment.
 */
export interface TargetDatabaseMetadata {
  engine: 'postgresql';
  version: string;
  databaseName: string;
  schemaName: string;
  connectionString?: string;
  targetTable?: string;
  estimatedRowCount?: number;
  tableSizeBytes?: number;
  activeConnectionCount?: number;
  isProductionLike: boolean;
}

/**
 * Structured details extracted from a single DDL statement.
 */
export interface ParsedMigrationStatement {
  statementIndex: number;
  rawSql: string;
  normalizedSql: string;
  operationType: MigrationOperationType;
  schemaName?: string;
  tableName?: string;
  columnName?: string;
  newColumnType?: string;
  constraintName?: string;
  indexName?: string;
  columns?: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  isConcurrent?: boolean;
  isNotNull?: boolean;
  hasDefault?: boolean;
  defaultValue?: string;
  ifExists?: boolean;
  ifNotExists?: boolean;
  hasCascade?: boolean;
  isNotValid?: boolean;
  isGenerated?: boolean;
}

/**
 * A planned single DDL statement within a migration script.
 */
export interface PlannedStatement {
  statementIndex: number;
  sql: string;
  operationType: MigrationOperationType;
  targetObject: string;
  estimatedLockType?: string;
}

/**
 * Full details of the proposed schema migration.
 */
export interface ProposedMigration {
  migrationId: string;
  name: string;
  description?: string;
  rawSql: string;
  targetSchema?: string;
  targetTable?: string;
  primaryOperation?: MigrationOperationType;
  plannedStatements?: PlannedStatement[];
  rollbackSql?: string;
  author?: string;
}

/**
 * Initial migration request submitted by a user or upstream CI/CD system.
 */
export interface MigrationRequest {
  requestId: string;
  createdAt: string;
  targetDatabase: TargetDatabaseMetadata;
  proposedMigration: ProposedMigration;
  requestMetadata?: Record<string, unknown>;
}
