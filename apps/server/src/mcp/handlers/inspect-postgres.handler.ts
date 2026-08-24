/**
 * SchemaSentry PostgreSQL Inspection MCP Tool Handler
 *
 * Implements the core logic for the inspect_postgres_target tool.
 * Reuses PostgresInspectionService and PostgresInspectionPort for safe, read-only catalog queries.
 */
import type { InspectPostgresTargetInput, InspectPostgresTargetOutput } from '@orvexa/shared';
import type { PostgresInspectionPort } from '../../db/ports/postgres-inspection.port.js';
import { isValidIdentifier } from '../../db/utils/sanitizer.js';

export class InspectPostgresHandler {
  constructor(private readonly inspectionPort: PostgresInspectionPort) {}

  /**
   * Executes read-only PostgreSQL inspection for a given table target.
   *
   * @param rawInput - Untrusted input object from MCP tool invocation.
   * @returns Structured, sanitized InspectPostgresTargetOutput.
   */
  async handle(rawInput: unknown): Promise<InspectPostgresTargetOutput> {
    const input = this.validateInput(rawInput);
    const schema = input.schema || 'public';
    const table = input.table;

    // 1. Gather server metadata
    const serverMetadata = await this.inspectionPort.getServerMetadata();

    // 2. Perform consolidated table inspection
    const fullInspection = await this.inspectionPort.inspectFullTable(schema, table);

    // 3. Gather active lock information and running queries for context
    const [activeQueries, lockInfo] = await Promise.all([
      this.inspectionPort.getActiveQueries().catch(() => []),
      this.inspectionPort.getLockInformation().catch(() => []),
    ]);

    // Format output
    return {
      target: {
        database: 'postgres',
        schema: fullInspection.table.schemaName,
        table: fullInspection.table.tableName,
      },
      serverMetadata: {
        version: serverMetadata.version,
        majorVersion: serverMetadata.majorVersion,
      },
      tableDetails: {
        estimatedRowCount:
          fullInspection.statistics?.liveTuples ?? fullInspection.table.estimatedRowCount,
        tableSizeBytes:
          fullInspection.statistics?.tableSizeBytes ?? fullInspection.table.tableSizeBytes,
        columns: fullInspection.columns.map((c) => ({
          name: c.columnName,
          dataType: c.dataType,
          isNullable: c.isNullable,
          defaultValue: c.columnDefault,
          characterMaximumLength: c.characterMaximumLength,
          numericPrecision: c.numericPrecision,
        })),
        primaryKey: fullInspection.primaryKey
          ? {
              name: fullInspection.primaryKey.name,
              columns: fullInspection.primaryKey.columnNames,
            }
          : null,
        foreignKeys: fullInspection.foreignKeys.map((fk) => ({
          name: fk.name,
          columnName: fk.columnNames[0] || '',
          foreignTable: fk.foreignTableName || '',
          foreignColumn: fk.foreignColumnNames?.[0] || '',
        })),
        indexes: fullInspection.indexes.map((idx) => ({
          name: idx.indexName,
          isUnique: idx.isUnique,
          isPrimary: idx.isPrimary,
          definition: idx.indexDefinition,
          indexSizeBytes: idx.sizeBytes,
        })),
      },
      activitySummary: {
        activeQueriesCount: activeQueries.length,
        activeLocksCount: lockInfo.length,
      },
      inspectedAt: new Date().toISOString(),
    };
  }

  /**
   * Strictly validates MCP tool input to prevent SQL injection and malformed identifiers.
   */
  private validateInput(raw: unknown): InspectPostgresTargetInput {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Input must be a valid JSON object');
    }

    const obj = raw as Record<string, unknown>;

    // Validate table
    if (!obj.table || typeof obj.table !== 'string') {
      throw new Error('Missing required parameter: "table"');
    }

    const table = obj.table.trim();
    if (!table || !isValidIdentifier(table)) {
      throw new Error(
        `Invalid table identifier "${table}". Table name must contain only alphanumeric characters and underscores.`
      );
    }

    // Validate schema
    let schema: string | undefined;
    if (obj.schema !== undefined && obj.schema !== null) {
      if (typeof obj.schema !== 'string') {
        throw new Error('Parameter "schema" must be a string if provided');
      }
      schema = obj.schema.trim();
      if (!schema || !isValidIdentifier(schema)) {
        throw new Error(
          `Invalid schema identifier "${schema}". Schema name must contain only alphanumeric characters and underscores.`
        );
      }
    }

    const includeDependencies =
      obj.includeDependencies !== undefined ? Boolean(obj.includeDependencies) : true;

    return {
      schema,
      table,
      includeDependencies,
    };
  }
}
