import type {
  FullTableInspection,
  RehearsalConnectionConfig,
  RehearsalEnvironment,
  RehearsalProvisionOptions,
  RehearsalSchemaCloneResult,
} from '@orvexa/shared';

/**
 * RehearsalDatabasePort
 *
 * Application-level port interface decoupling disposable PostgreSQL provisioning,
 * schema cloning, fixture seeding, and cleanup from specific infrastructure adapters.
 */
export interface RehearsalDatabasePort {
  /**
   * Provisions a fresh, isolated PostgreSQL rehearsal database.
   */
  provision(
    rehearsalId: string,
    options?: RehearsalProvisionOptions
  ): Promise<RehearsalEnvironment>;

  /**
   * Reconstructs the target schema objects into the provisioned rehearsal database.
   */
  cloneSchema(
    rehearsalId: string,
    tableInspections: FullTableInspection[]
  ): Promise<RehearsalSchemaCloneResult>;

  /**
   * Seeds small, deterministic synthetic fixture rows into the rehearsal database.
   */
  seedFixtures(
    rehearsalId: string,
    tableInspections: FullTableInspection[],
    rowLimit?: number
  ): Promise<number>;

  /**
   * Retrieves the current environment descriptor for a rehearsal database.
   */
  getEnvironment(rehearsalId: string): Promise<RehearsalEnvironment | null>;

  /**
   * Obtains internal connection configuration for the rehearsal environment.
   * Credentials must never be logged or exposed publicly.
   */
  getConnectionConfig(rehearsalId: string): Promise<RehearsalConnectionConfig>;

  /**
   * Drops and tears down the disposable rehearsal database. Idempotent.
   */
  cleanup(rehearsalId: string): Promise<void>;

  /**
   * Lists all active or tracked rehearsal environments.
   */
  listEnvironments(): Promise<RehearsalEnvironment[]>;
}
