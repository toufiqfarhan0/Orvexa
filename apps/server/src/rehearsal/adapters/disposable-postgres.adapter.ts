import pg from 'pg';
import type {
  FullTableInspection,
  RehearsalConnectionConfig,
  RehearsalEnvironment,
  RehearsalProvisionOptions,
  RehearsalSchemaCloneResult,
  StatementExecutionEvidence,
} from '@orvexa/shared';
import type { RehearsalDatabasePort } from '../ports/rehearsal-database.port.js';
import { SchemaDdlGenerator } from '../utils/schema-ddl-generator.js';
import { SyntheticFixtureGenerator } from '../utils/synthetic-fixture-generator.js';
import { validateIdentifier } from '../../db/utils/sanitizer.js';
import { PgInspectionAdapter } from '../../db/adapters/pg-inspection.adapter.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';

export interface DisposablePostgresAdapterOptions {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  logger?: TrueForgeLogger;
}

interface TrackedRehearsal {
  environment: RehearsalEnvironment;
  connectionConfig: RehearsalConnectionConfig;
}

/**
 * DisposablePostgresAdapter
 *
 * Implements RehearsalDatabasePort by provisioning, cloning, executing, and dropping
 * isolated PostgreSQL databases on the target server without touching the source database.
 */
export class DisposablePostgresAdapter implements RehearsalDatabasePort {
  private readonly adminConfig: RehearsalConnectionConfig;
  private readonly logger: TrueForgeLogger;
  private readonly trackedRehearsals = new Map<string, TrackedRehearsal>();

  constructor(options?: DisposablePostgresAdapterOptions) {
    this.logger = options?.logger || new TrueForgeLogger('[Orvexa:Rehearsal]');

    const rawUrl =
      options?.connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    const parsed = new URL(rawUrl);

    const dbFromPath = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';

    this.adminConfig = {
      host: options?.host || parsed.hostname || 'localhost',
      port: options?.port || (parsed.port ? parseInt(parsed.port, 10) : 5432),
      user: options?.user || parsed.username || 'postgres',
      password: options?.password || parsed.password || 'postgres',
      database: dbFromPath || 'postgres',
      ssl: parsed.searchParams.get('sslmode') === 'require',
    };
  }

  /**
   * Provisions a fresh, isolated PostgreSQL database for migration rehearsal.
   */
  async provision(
    rehearsalId: string,
    options?: RehearsalProvisionOptions
  ): Promise<RehearsalEnvironment> {
    const startTime = Date.now();
    const cleanId = this.sanitizeRehearsalId(rehearsalId);
    const dbName = `rehearsal_${cleanId}`;

    this.logger.info('Provisioning disposable rehearsal database', {
      rehearsalId,
      databaseName: dbName,
    });

    const environment: RehearsalEnvironment = {
      rehearsalId,
      sourceTargetId: options?.sourceTargetId || this.adminConfig.database,
      postgresVersion: 'PostgreSQL 16',
      databaseName: dbName,
      schemaName: 'public',
      status: 'CREATING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: options?.ttlMinutes
        ? new Date(Date.now() + options.ttlMinutes * 60 * 1000).toISOString()
        : undefined,
      tableCount: 0,
      clonedTables: [],
      fixtureRowCount: 0,
    };

    const targetConfig: RehearsalConnectionConfig = {
      ...this.adminConfig,
      database: dbName,
    };

    this.trackedRehearsals.set(rehearsalId, {
      environment,
      connectionConfig: targetConfig,
    });

    const adminPool = new pg.Pool({
      host: this.adminConfig.host,
      port: this.adminConfig.port,
      user: this.adminConfig.user,
      password: this.adminConfig.password,
      database: this.adminConfig.database,
      ssl: this.adminConfig.ssl,
      max: 2,
    });

    try {
      const createDbSql = `CREATE DATABASE "${validateIdentifier(dbName, 'databaseName')}" WITH OWNER "${validateIdentifier(this.adminConfig.user, 'userName')}" ENCODING 'UTF8';`;
      await adminPool.query(createDbSql);

      environment.status = 'READY';
      environment.updatedAt = new Date().toISOString();

      const durationMs = Date.now() - startTime;
      this.logger.info('Successfully provisioned disposable rehearsal database', {
        rehearsalId,
        databaseName: dbName,
        durationMs,
      });

      return { ...environment };
    } catch (err: unknown) {
      environment.status = 'FAILED';
      environment.error = err instanceof Error ? err.message : String(err);
      environment.updatedAt = new Date().toISOString();

      this.logger.error('Failed to provision disposable rehearsal database', {
        rehearsalId,
        error: environment.error,
      });

      throw new Error(`Disposable database provisioning failed: ${environment.error}`);
    } finally {
      await adminPool.end();
    }
  }

  /**
   * Reconstructs the target schema objects in the disposable rehearsal database.
   */
  async cloneSchema(
    rehearsalId: string,
    tableInspections: FullTableInspection[]
  ): Promise<RehearsalSchemaCloneResult> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    if (!tracked) {
      throw new Error(`Rehearsal environment not found: ${rehearsalId}`);
    }

    const startTime = Date.now();
    tracked.environment.status = 'INITIALIZING';
    tracked.environment.updatedAt = new Date().toISOString();

    this.logger.info('Cloning schema objects into rehearsal database', {
      rehearsalId,
      databaseName: tracked.environment.databaseName,
      tablesCount: tableInspections.length,
    });

    const ddl = SchemaDdlGenerator.generateDdl(tableInspections);

    const rehearsalPool = new pg.Pool({
      host: tracked.connectionConfig.host,
      port: tracked.connectionConfig.port,
      user: tracked.connectionConfig.user,
      password: tracked.connectionConfig.password,
      database: tracked.connectionConfig.database,
      ssl: tracked.connectionConfig.ssl,
      max: 2,
    });

    try {
      const client = await rehearsalPool.connect();
      try {
        for (const statement of ddl.allInOrder) {
          await client.query(statement);
        }
      } finally {
        client.release();
      }

      const clonedTableNames = tableInspections.map((t) => t.table.tableName);
      let totalCols = 0;
      let totalPks = 0;
      let totalFks = 0;
      let totalConstraints = 0;
      let totalIndexes = 0;

      for (const t of tableInspections) {
        totalCols += t.columns.length;
        if (t.primaryKey) totalPks++;
        totalFks += (t.foreignKeys || []).length;
        totalConstraints += (t.constraints || []).length;
        totalIndexes += (t.indexes || []).length;
      }

      tracked.environment.status = 'READY';
      tracked.environment.tableCount = clonedTableNames.length;
      tracked.environment.clonedTables = clonedTableNames;
      tracked.environment.updatedAt = new Date().toISOString();

      const durationMs = Date.now() - startTime;
      const result: RehearsalSchemaCloneResult = {
        tablesCreated: clonedTableNames.length,
        columnsCreated: totalCols,
        primaryKeysCreated: totalPks,
        foreignKeysCreated: totalFks,
        constraintsCreated: totalConstraints,
        indexesCreated: totalIndexes,
        fixtureRowsInserted: 0,
        durationMs,
      };

      this.logger.info('Schema cloning completed successfully in rehearsal database', {
        rehearsalId,
        tablesCreated: result.tablesCreated,
        durationMs,
      });

      return result;
    } catch (err: unknown) {
      tracked.environment.status = 'FAILED';
      tracked.environment.error = err instanceof Error ? err.message : String(err);
      tracked.environment.updatedAt = new Date().toISOString();

      this.logger.error('Failed to clone schema into rehearsal database', {
        rehearsalId,
        error: tracked.environment.error,
      });

      throw new Error(`Schema cloning failed: ${tracked.environment.error}`);
    } finally {
      await rehearsalPool.end();
    }
  }

  /**
   * Seeds small deterministic synthetic fixture rows into the rehearsal database.
   */
  async seedFixtures(
    rehearsalId: string,
    tableInspections: FullTableInspection[],
    rowLimit: number = 3
  ): Promise<number> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    if (!tracked) {
      throw new Error(`Rehearsal environment not found: ${rehearsalId}`);
    }

    const plans = SyntheticFixtureGenerator.generateSeedPlans(tableInspections, rowLimit);
    let totalInserted = 0;

    const rehearsalPool = new pg.Pool({
      host: tracked.connectionConfig.host,
      port: tracked.connectionConfig.port,
      user: tracked.connectionConfig.user,
      password: tracked.connectionConfig.password,
      database: tracked.connectionConfig.database,
      ssl: tracked.connectionConfig.ssl,
      max: 2,
    });

    try {
      const client = await rehearsalPool.connect();
      try {
        for (const plan of plans) {
          for (const insertSql of plan.insertStatements) {
            await client.query(insertSql);
            totalInserted++;
          }
        }
      } finally {
        client.release();
      }

      tracked.environment.fixtureRowCount = totalInserted;
      tracked.environment.updatedAt = new Date().toISOString();

      this.logger.info('Synthetic fixture seeding completed', {
        rehearsalId,
        totalRows: totalInserted,
      });

      return totalInserted;
    } catch (err: unknown) {
      this.logger.error('Failed to seed fixtures in rehearsal database', {
        rehearsalId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      await rehearsalPool.end();
    }
  }

  /**
   * Executes a sequence of statements inside the disposable rehearsal database.
   */
  async executeStatements(
    rehearsalId: string,
    statements: string[]
  ): Promise<StatementExecutionEvidence[]> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    if (!tracked) {
      throw new Error(`Rehearsal environment not found: ${rehearsalId}`);
    }

    tracked.environment.status = 'IN_USE';
    tracked.environment.updatedAt = new Date().toISOString();

    const rehearsalPool = new pg.Pool({
      host: tracked.connectionConfig.host,
      port: tracked.connectionConfig.port,
      user: tracked.connectionConfig.user,
      password: tracked.connectionConfig.password,
      database: tracked.connectionConfig.database,
      ssl: tracked.connectionConfig.ssl,
      max: 2,
    });

    const results: StatementExecutionEvidence[] = [];

    try {
      const client = await rehearsalPool.connect();
      try {
        for (let i = 0; i < statements.length; i++) {
          const sql = statements[i].trim();
          if (!sql) continue;

          const stmtStart = Date.now();
          try {
            const queryRes = await client.query(sql);
            const durationMs = Date.now() - stmtStart;
            results.push({
              statementIndex: i,
              sql,
              status: 'SUCCESS',
              durationMs,
              rowsAffected: queryRes.rowCount || 0,
            });
          } catch (err: unknown) {
            const durationMs = Date.now() - stmtStart;
            const errorMsg = err instanceof Error ? err.message : String(err);
            results.push({
              statementIndex: i,
              sql,
              status: 'FAILED',
              durationMs,
              error: errorMsg,
            });
            // Stop execution on first statement failure
            break;
          }
        }
      } finally {
        client.release();
      }

      return results;
    } finally {
      await rehearsalPool.end();
    }
  }

  /**
   * Inspects all tables inside the disposable rehearsal database.
   */
  async inspectRehearsalTables(
    rehearsalId: string,
    schemaName: string = 'public'
  ): Promise<FullTableInspection[]> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    if (!tracked) {
      throw new Error(`Rehearsal environment not found: ${rehearsalId}`);
    }

    const user = encodeURIComponent(tracked.connectionConfig.user);
    const password = encodeURIComponent(tracked.connectionConfig.password || '');
    const host = tracked.connectionConfig.host;
    const port = tracked.connectionConfig.port;
    const db = encodeURIComponent(tracked.connectionConfig.database);
    const sslParam = tracked.connectionConfig.ssl ? '?sslmode=require' : '';
    const connStr = `postgresql://${user}:${password}@${host}:${port}/${db}${sslParam}`;
    const inspector = new PgInspectionAdapter({ connectionString: connStr });

    try {
      const dbMeta = await inspector.getDatabaseMetadata(schemaName);
      const inspections: FullTableInspection[] = [];

      for (const t of dbMeta.tables) {
        const tableInspection = await inspector.inspectFullTable(
          t.schemaName || schemaName,
          t.tableName
        );
        inspections.push(tableInspection);
      }

      return inspections;
    } finally {
      await inspector.close();
    }
  }

  /**
   * Retrieves public environment status.
   */
  async getEnvironment(rehearsalId: string): Promise<RehearsalEnvironment | null> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    return tracked ? { ...tracked.environment } : null;
  }

  /**
   * Obtains internal connection configuration.
   */
  async getConnectionConfig(rehearsalId: string): Promise<RehearsalConnectionConfig> {
    const tracked = this.trackedRehearsals.get(rehearsalId);
    if (!tracked) {
      throw new Error(`Rehearsal environment not found: ${rehearsalId}`);
    }
    return { ...tracked.connectionConfig };
  }

  /**
   * Drops and tears down the disposable rehearsal database idempotently.
   */
  async cleanup(rehearsalId: string): Promise<void> {
    const cleanId = this.sanitizeRehearsalId(rehearsalId);
    const dbName = `rehearsal_${cleanId}`;

    this.logger.info('Cleaning up disposable rehearsal database', {
      rehearsalId,
      databaseName: dbName,
    });

    const adminPool = new pg.Pool({
      host: this.adminConfig.host,
      port: this.adminConfig.port,
      user: this.adminConfig.user,
      password: this.adminConfig.password,
      database: this.adminConfig.database,
      ssl: this.adminConfig.ssl,
      max: 2,
    });

    try {
      const terminateSql = `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid();
      `;
      await adminPool.query(terminateSql, [dbName]);

      const dropDbSql = `DROP DATABASE IF EXISTS "${validateIdentifier(dbName, 'databaseName')}" WITH (FORCE);`;
      await adminPool.query(dropDbSql);

      const tracked = this.trackedRehearsals.get(rehearsalId);
      if (tracked) {
        tracked.environment.status = 'DELETED';
        tracked.environment.updatedAt = new Date().toISOString();
        this.trackedRehearsals.delete(rehearsalId);
      }

      this.logger.info('Successfully cleaned up disposable rehearsal database', {
        rehearsalId,
        databaseName: dbName,
      });
    } catch (err: unknown) {
      this.logger.warn('Warning during rehearsal cleanup (may already be dropped)', {
        rehearsalId,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await adminPool.end();
    }
  }

  /**
   * Lists all currently tracked environments.
   */
  async listEnvironments(): Promise<RehearsalEnvironment[]> {
    return Array.from(this.trackedRehearsals.values()).map((t) => ({ ...t.environment }));
  }

  /**
   * Sanitizes a rehearsal identifier into a safe database name segment.
   */
  private sanitizeRehearsalId(id: string): string {
    return id
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 48);
  }
}
