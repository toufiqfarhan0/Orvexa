import type {
  PostgresServerMetadata,
  SchemaMetadata,
  TableMetadata,
  DatabaseMetadata,
  FullTableInspection,
  ActiveQuery,
  LockInformation,
} from '@orvexa/shared';
import type { PostgresInspectionPort } from '../ports/postgres-inspection.port.js';

/**
 * PostgresInspectionService - Application Service for inspecting target PostgreSQL databases.
 * Sits above the PostgresInspectionPort, providing a high-level application inspection API.
 */
export class PostgresInspectionService {
  constructor(private readonly inspectionPort: PostgresInspectionPort) {}

  public async verifyTargetDatabase(): Promise<{
    connected: boolean;
    latencyMs: number;
    database: string;
    currentUser: string;
  }> {
    return this.inspectionPort.verifyConnectivity();
  }

  public async inspectServer(): Promise<PostgresServerMetadata> {
    return this.inspectionPort.getServerMetadata();
  }

  public async inspectDatabase(targetSchema?: string): Promise<DatabaseMetadata> {
    return this.inspectionPort.getDatabaseMetadata(targetSchema);
  }

  public async inspectSchemas(): Promise<SchemaMetadata[]> {
    return this.inspectionPort.inspectSchemas();
  }

  public async inspectTables(schemaName?: string): Promise<TableMetadata[]> {
    return this.inspectionPort.inspectTables(schemaName);
  }

  public async inspectTable(schemaName: string, tableName: string): Promise<FullTableInspection> {
    return this.inspectionPort.inspectFullTable(schemaName, tableName);
  }

  public async inspectActiveQueries(): Promise<ActiveQuery[]> {
    return this.inspectionPort.getActiveQueries();
  }

  public async inspectLocks(schemaName?: string, tableName?: string): Promise<LockInformation[]> {
    return this.inspectionPort.getLockInformation(schemaName, tableName);
  }

  public async close(): Promise<void> {
    return this.inspectionPort.close();
  }
}
