import type {
  FullTableInspection,
  TableMetadata,
  ColumnMetadata,
  ConstraintMetadata,
  IndexMetadata,
} from './database-inspection.js';

/**
 * Lifecycle status of a disposable rehearsal database environment.
 */
export type RehearsalStatus =
  'CREATING' | 'INITIALIZING' | 'READY' | 'IN_USE' | 'CLEANING_UP' | 'DELETED' | 'FAILED';

/**
 * Public, secret-scrubbed descriptor of an isolated rehearsal environment.
 */
export interface RehearsalEnvironment {
  rehearsalId: string;
  sourceTargetId: string;
  postgresVersion: string;
  databaseName: string;
  schemaName: string;
  status: RehearsalStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  tableCount: number;
  clonedTables: string[];
  fixtureRowCount: number;
  error?: string;
}

/**
 * Controlled connection parameters for internal database execution.
 * Passwords are never serialized into logs or public descriptors.
 */
export interface RehearsalConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

/**
 * Options for provisioning a disposable rehearsal database.
 */
export interface RehearsalProvisionOptions {
  sourceTargetId?: string;
  targetTables?: string[];
  includeFixtures?: boolean;
  fixtureRowLimit?: number;
  ttlMinutes?: number;
}

/**
 * Report summary for schema cloning into the disposable rehearsal database.
 */
export interface RehearsalSchemaCloneResult {
  tablesCreated: number;
  columnsCreated: number;
  primaryKeysCreated: number;
  foreignKeysCreated: number;
  constraintsCreated: number;
  indexesCreated: number;
  fixtureRowsInserted: number;
  durationMs: number;
}

/**
 * Structured differential representation for schema changes.
 */
export interface SchemaObjectDiff<T> {
  added: T[];
  removed: T[];
  modified: Array<{
    name: string;
    before: T;
    after: T;
  }>;
}

/**
 * Aggregated schema differences between pre-migration and post-migration states.
 */
export interface SchemaDiffResult {
  tables: SchemaObjectDiff<TableMetadata>;
  columns: SchemaObjectDiff<ColumnMetadata>;
  primaryKeys: SchemaObjectDiff<ConstraintMetadata>;
  foreignKeys: SchemaObjectDiff<ConstraintMetadata>;
  constraints: SchemaObjectDiff<ConstraintMetadata>;
  indexes: SchemaObjectDiff<IndexMetadata>;
  hasChanges: boolean;
  summary: string[];
}

/**
 * Execution record for a single SQL statement in the rehearsal sandbox.
 */
export interface StatementExecutionEvidence {
  statementIndex: number;
  sql: string;
  status: 'SUCCESS' | 'FAILED';
  durationMs: number;
  rowsAffected?: number;
  error?: string;
}

/**
 * Comprehensive evidence payload produced by a migration rehearsal run.
 */
export interface MigrationRehearsalEvidence {
  rehearsalId: string;
  sessionId: string;
  sandboxId?: string;
  executionId?: string;
  turnId?: string;
  migrationId: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  statementsAttempted: number;
  statementsSucceeded: number;
  statementsFailed: number;
  statementResults: StatementExecutionEvidence[];
  affectedTables: string[];
  preMigrationInspection: FullTableInspection[];
  postMigrationInspection: FullTableInspection[];
  schemaDifferences: SchemaDiffResult;
  lockObservations?: string;
  rollbackStatus: 'DISCARDED' | 'NOT_APPLICABLE';
  cleanupStatus: 'COMPLETED' | 'FAILED';
  failureReason?: string;
}
