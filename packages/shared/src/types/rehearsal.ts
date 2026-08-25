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
