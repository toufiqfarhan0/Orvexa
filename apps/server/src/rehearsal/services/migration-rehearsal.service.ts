import type {
  FullTableInspection,
  RehearsalConnectionConfig,
  RehearsalEnvironment,
  RehearsalProvisionOptions,
  RehearsalSchemaCloneResult,
} from '@orvexa/shared';
import type { RehearsalDatabasePort } from '../ports/rehearsal-database.port.js';
import type { PostgresInspectionPort } from '../../db/ports/postgres-inspection.port.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';

export interface MigrationRehearsalServiceOptions {
  rehearsalDbPort: RehearsalDatabasePort;
  inspectionPort?: PostgresInspectionPort;
  logger?: TrueForgeLogger;
}

export interface PrepareRehearsalResult {
  environment: RehearsalEnvironment;
  cloneSummary: RehearsalSchemaCloneResult;
}

/**
 * MigrationRehearsalService
 *
 * Coordinates the provisioning of disposable PostgreSQL databases,
 * retrieval of pre-migration table metadata from PostgresInspectionPort,
 * schema cloning, and synthetic fixture seeding.
 */
export class MigrationRehearsalService {
  private readonly rehearsalDb: RehearsalDatabasePort;
  private readonly inspectionPort?: PostgresInspectionPort;
  private readonly logger: TrueForgeLogger;

  constructor(options: MigrationRehearsalServiceOptions) {
    this.rehearsalDb = options.rehearsalDbPort;
    this.inspectionPort = options.inspectionPort;
    this.logger = options.logger || new TrueForgeLogger('[Orvexa:RehearsalService]');
  }

  /**
   * Prepares a ready, isolated rehearsal database pre-loaded with target schema and synthetic data.
   */
  async prepareRehearsal(
    rehearsalId: string,
    options?: RehearsalProvisionOptions,
    providedInspections?: FullTableInspection[]
  ): Promise<PrepareRehearsalResult> {
    const startTime = Date.now();
    this.logger.info('Starting migration rehearsal environment preparation', {
      rehearsalId,
      hasInspectionPort: Boolean(this.inspectionPort),
      providedInspectionsCount: providedInspections?.length,
    });

    // 1. Resolve table inspections
    const tableInspections: FullTableInspection[] = providedInspections
      ? [...providedInspections]
      : [];
    if (tableInspections.length === 0 && this.inspectionPort) {
      const targetTables = options?.targetTables;
      if (targetTables && targetTables.length > 0) {
        for (const tableName of targetTables) {
          const inspection = await this.inspectionPort.inspectFullTable('public', tableName);
          tableInspections.push(inspection);
        }
      } else {
        // Inspect all tables in target database
        const dbMeta = await this.inspectionPort.getDatabaseMetadata();
        for (const table of dbMeta.tables) {
          const inspection = await this.inspectionPort.inspectFullTable(
            table.schemaName || 'public',
            table.tableName
          );
          tableInspections.push(inspection);
        }
      }
    }

    if (tableInspections.length === 0) {
      throw new Error(
        `Cannot prepare rehearsal database: No table metadata available for rehearsalId '${rehearsalId}'.`
      );
    }

    // 2. Provision isolated PostgreSQL database
    const environment = await this.rehearsalDb.provision(rehearsalId, options);

    // 3. Clone schema into rehearsal database
    const cloneSummary = await this.rehearsalDb.cloneSchema(rehearsalId, tableInspections);

    // 4. Optionally seed synthetic fixture data
    if (options?.includeFixtures !== false) {
      const rowLimit = options?.fixtureRowLimit || 3;
      const rowsSeeded = await this.rehearsalDb.seedFixtures(
        rehearsalId,
        tableInspections,
        rowLimit
      );
      cloneSummary.fixtureRowsInserted = rowsSeeded;
    }

    const updatedEnv = (await this.rehearsalDb.getEnvironment(rehearsalId)) || environment;
    const totalDurationMs = Date.now() - startTime;

    this.logger.info('Migration rehearsal environment prepared successfully', {
      rehearsalId,
      databaseName: updatedEnv.databaseName,
      tablesCount: updatedEnv.tableCount,
      fixturesCount: updatedEnv.fixtureRowCount,
      durationMs: totalDurationMs,
    });

    return {
      environment: updatedEnv,
      cloneSummary,
    };
  }

  /**
   * Retrieves connection config for internal rehearsal execution or sandbox worker.
   */
  async getConnectionConfig(rehearsalId: string): Promise<RehearsalConnectionConfig> {
    return this.rehearsalDb.getConnectionConfig(rehearsalId);
  }

  /**
   * Retrieves public environment descriptor.
   */
  async getRehearsal(rehearsalId: string): Promise<RehearsalEnvironment | null> {
    return this.rehearsalDb.getEnvironment(rehearsalId);
  }

  /**
   * Tears down disposable rehearsal database. Idempotent.
   */
  async cleanupRehearsal(rehearsalId: string): Promise<void> {
    this.logger.info('Tearing down migration rehearsal environment', { rehearsalId });
    await this.rehearsalDb.cleanup(rehearsalId);
  }

  /**
   * Lists all active rehearsal environments.
   */
  async listRehearsals(): Promise<RehearsalEnvironment[]> {
    return this.rehearsalDb.listEnvironments();
  }
}
