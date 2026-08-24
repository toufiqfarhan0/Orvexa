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
  | 'DROP_CONSTRAINT'
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'RENAME_TABLE'
  | 'CUSTOM_DDL';

/**
 * Metadata describing the target database environment.
 */
export interface TargetDatabaseMetadata {
  engine: 'postgresql';
  version: string;
  databaseName: string;
  schemaName: string;
  targetTable?: string;
  estimatedRowCount?: number;
  tableSizeBytes?: number;
  activeConnectionCount?: number;
  isProductionLike: boolean;
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
  primaryOperation: MigrationOperationType;
  plannedStatements: PlannedStatement[];
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
