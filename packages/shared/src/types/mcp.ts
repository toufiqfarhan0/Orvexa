/**
 * Orvexa Model Context Protocol (MCP) Contracts
 *
 * Defines strictly typed, read-only inspection tool contracts for AI agents
 * interacting with PostgreSQL targets through the TrueForge MCP boundary.
 */

/**
 * Input parameters for inspect_postgres_target tool.
 */
export interface InspectPostgresTargetInput {
  /**
   * Target PostgreSQL schema name (defaults to 'public').
   * Must be a valid SQL identifier.
   */
  schema?: string;

  /**
   * Target PostgreSQL table name to inspect.
   * Must be a valid SQL identifier.
   */
  table: string;

  /**
   * Whether to include foreign key dependencies and referential constraints (default: true).
   */
  includeDependencies?: boolean;
}

/**
 * Structured, sanitized output for inspect_postgres_target tool.
 * Provides rich table schema, constraints, indexes, statistics, and lock activity.
 */
export interface InspectPostgresTargetOutput {
  /**
   * Target database and table identifier.
   */
  target: {
    database: string;
    schema: string;
    table: string;
  };

  /**
   * PostgreSQL server metadata.
   */
  serverMetadata: {
    version: string;
    majorVersion: number;
  };

  /**
   * Comprehensive table structure and catalog metadata.
   */
  tableDetails: {
    estimatedRowCount: number;
    tableSizeBytes: number;
    tableSizePretty?: string;
    columns: Array<{
      name: string;
      dataType: string;
      isNullable: boolean;
      defaultValue?: string | null;
      characterMaximumLength?: number | null;
      numericPrecision?: number | null;
    }>;
    primaryKey?: {
      name: string;
      columns: string[];
    } | null;
    foreignKeys: Array<{
      name: string;
      columnName: string;
      foreignTable: string;
      foreignColumn: string;
    }>;
    indexes: Array<{
      name: string;
      isUnique: boolean;
      isPrimary: boolean;
      definition: string;
      indexSizeBytes?: number;
    }>;
  };

  /**
   * Current lock activity and running query summary for the table.
   */
  activitySummary: {
    activeQueriesCount: number;
    activeLocksCount: number;
  };

  /**
   * ISO timestamp of when the inspection occurred.
   */
  inspectedAt: string;
}

/**
 * MCP Server registration manifest for TrueForge.
 */
export interface TrueForgeMcpManifest {
  name: string;
  description: string;
  type: 'remote';
  url: string;
}
