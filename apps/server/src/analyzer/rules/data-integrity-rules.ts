import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { MigrationAnalysisRule } from './rule.interface.js';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Rule: NOT NULL Column Added Without Default Value
 * Detects adding a NOT NULL column without a DEFAULT value on non-empty tables.
 */
export class NotNullWithoutDefaultRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-001';
  public readonly name = 'NOT NULL Column Without Default Value';
  public readonly description =
    'Adding a NOT NULL column without a DEFAULT value to a table with existing rows will fail execution or reject existing rows.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (
        stmt.operationType === 'ADD_COLUMN' &&
        stmt.isNotNull &&
        !stmt.hasDefault &&
        !stmt.isGenerated
      ) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;
        const hasExistingRows = rowCount > 0;

        findings.push({
          id: `finding-data-001-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: hasExistingRows ? 'CRITICAL' : 'HIGH',
          category: 'DATA_INTEGRITY',
          title: `Column '${stmt.columnName || 'unknown'}' added as NOT NULL without default`,
          explanation: `The migration adds column '${stmt.columnName}' with a NOT NULL constraint but specifies no DEFAULT value.${
            hasExistingRows
              ? ` Table '${tableKey}' contains ~${rowCount.toLocaleString('en-US')} existing rows. In PostgreSQL, this statement will fail immediately because existing rows cannot satisfy the NOT NULL constraint.`
              : ' If any rows exist in the table, execution will fail.'
          }`,
          affectedObject: `${tableKey}.${stmt.columnName || ''}`,
          evidence: `Statement: "${stmt.rawSql}"${hasExistingRows ? ` | Table live tuples: ${rowCount.toLocaleString('en-US')}` : ''}`,
          recommendation:
            'Either: 1) Provide a DEFAULT value (e.g. `ADD COLUMN col type DEFAULT "value" NOT NULL;`), or 2) Add the column as nullable first, backfill existing rows, and then add the NOT NULL constraint.',
        });
      }
    }

    return findings;
  }
}

/**
 * Rule: Dropping Referenced Column
 * Detects dropping a column that is actively part of a Primary Key, Foreign Key, or Unique constraint.
 */
export class DroppingReferencedColumnRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-002';
  public readonly name = 'Dropping Referenced Column';
  public readonly description =
    'Dropping a column that is referenced by existing constraints or indexes breaks table integrity.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'DROP_COLUMN' && stmt.columnName) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        if (!inspection) continue;

        // Check Primary Key
        const pkCols =
          inspection.primaryKey?.columnNames ||
          (inspection.primaryKey as unknown as { columns?: string[] })?.columns ||
          [];
        if (pkCols.includes(stmt.columnName)) {
          findings.push({
            id: `finding-data-002-pk-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'CRITICAL',
            category: 'DATA_INTEGRITY',
            title: `Dropped column '${stmt.columnName}' is part of Primary Key '${inspection.primaryKey?.name}'`,
            explanation: `Column '${stmt.columnName}' forms part of the primary key '${inspection.primaryKey?.name}' on table '${tableKey}'. Dropping this column will destroy the table's primary identity constraint.`,
            affectedObject: `${tableKey}.${stmt.columnName}`,
            evidence: `Existing Primary Key: ${inspection.primaryKey?.name}`,
            recommendation:
              'Do not drop primary key columns without a planned multi-step primary key replacement strategy.',
          });
        }

        // Check Foreign Keys on this table
        const matchingFk = inspection.foreignKeys.find((fk) => {
          const fkCols = fk.columnNames || (fk as unknown as { columns?: string[] }).columns || [];
          return fkCols.includes(stmt.columnName!);
        });
        if (matchingFk) {
          findings.push({
            id: `finding-data-002-fk-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'CRITICAL',
            category: 'DATA_INTEGRITY',
            title: `Dropped column '${stmt.columnName}' is part of Foreign Key '${matchingFk.name}'`,
            explanation: `Column '${stmt.columnName}' is referenced by Foreign Key '${matchingFk.name}' pointing to '${matchingFk.foreignTableName}'. Dropping it will break referential integrity.`,
            affectedObject: `${tableKey}.${stmt.columnName}`,
            evidence: `Foreign Key: ${matchingFk.name}`,
            recommendation:
              'Explicitly drop or migrate the foreign key constraint before dropping the dependent column.',
          });
        }

        // Check Indexes
        const matchingIndex = inspection.indexes.find((idx) => {
          const idxCols =
            idx.columnNames || (idx as unknown as { columns?: string[] }).columns || [];
          return idxCols.includes(stmt.columnName!) && !idx.isPrimary;
        });
        if (matchingIndex) {
          const idxName =
            matchingIndex.indexName ||
            (matchingIndex as unknown as { name?: string }).name ||
            'index';
          findings.push({
            id: `finding-data-002-idx-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'MEDIUM',
            category: 'DATA_INTEGRITY',
            title: `Dropped column '${stmt.columnName}' is indexed by '${idxName}'`,
            explanation: `Column '${stmt.columnName}' is a component of index '${idxName}'. PostgreSQL will drop or invalidate this index during column removal.`,
            affectedObject: `${tableKey}.${stmt.columnName}`,
            evidence: `Index: ${idxName}`,
            recommendation:
              'Ensure any application query patterns depending on this index have been migrated or retired.',
          });
        }
      }
    }

    return findings;
  }
}

/**
 * Rule: Dropping Table with Inbound Dependencies
 * Detects dropping a table that is targeted by Foreign Keys from other tables in the database.
 */
export class DroppingReferencedTableRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-003';
  public readonly name = 'Dropping Table with Foreign Key Dependencies';
  public readonly description =
    'Dropping a table that is referenced by foreign keys from other tables causes cascading deletion of constraints or fails execution.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'DROP_TABLE' && stmt.tableName) {
        const droppedTable = stmt.tableName;
        const droppedSchema = stmt.schemaName || 'public';

        // Search across all inspected tables for inbound FK references
        if (context.tableInspections) {
          for (const [tableKey, inspection] of Object.entries(context.tableInspections)) {
            if (inspection.table.tableName === droppedTable) continue;

            const inboundFks = inspection.foreignKeys.filter(
              (fk) =>
                fk.foreignTableName === droppedTable &&
                (fk.foreignSchemaName === droppedSchema || !fk.foreignSchemaName)
            );

            for (const fk of inboundFks) {
              const foreignCols = fk.foreignColumnNames ||
                (fk as unknown as { foreignColumns?: string[] }).foreignColumns || ['id'];
              findings.push({
                id: `finding-data-003-${stmt.statementIndex}-${fk.name}`,
                ruleId: this.ruleId,
                severity: 'CRITICAL',
                category: 'DATA_INTEGRITY',
                title: `Dropped table '${droppedTable}' is referenced by table '${tableKey}'`,
                explanation: `Table '${tableKey}' has foreign key constraint '${fk.name}' referencing '${droppedTable}.${foreignCols.join(',') || 'id'}'. ${
                  stmt.hasCascade
                    ? 'Dropping with CASCADE will automatically drop these foreign key constraints on dependent tables.'
                    : 'Dropping without CASCADE will be rejected by PostgreSQL.'
                }`,
                affectedObject: `${droppedSchema}.${droppedTable}`,
                evidence: `Inbound Foreign Key on ${tableKey}: ${fk.name}`,
                recommendation:
                  'Review and remove or redirect foreign key relationships from dependent tables before dropping this table.',
              });
            }
          }
        }
      }
    }

    return findings;
  }
}

/**
 * Rule: Unsafe Data Type Alteration / Narrowing
 * Detects altering a column type to a narrower or incompatible type.
 */
export class UnsafeTypeAlterationRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-004';
  public readonly name = 'Unsafe Data Type Conversion';
  public readonly description =
    'Changing a column to a smaller or incompatible type may cause data truncation, precision loss, or conversion errors.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'ALTER_COLUMN_TYPE' && stmt.columnName && stmt.newColumnType) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const existingCol = inspection?.columns.find((c) => c.columnName === stmt.columnName);

        const existingType = existingCol?.dataType.toUpperCase() || '';
        const newTypeUpper = stmt.newColumnType.toUpperCase();

        const isTextual =
          existingType.includes('VARCHAR') ||
          existingType.includes('CHARACTER VARYING') ||
          existingType.includes('TEXT') ||
          existingType.includes('CHAR');
        const isNumericTarget =
          newTypeUpper.includes('INT') ||
          newTypeUpper.includes('INTEGER') ||
          newTypeUpper.includes('NUMERIC') ||
          newTypeUpper.includes('DECIMAL');

        // Detect dangerous transitions (e.g. text/varchar to int, bigint to int, timestamp to date)
        const isDangerous =
          (isTextual && isNumericTarget) ||
          (existingType.includes('BIGINT') && newTypeUpper === 'INTEGER') ||
          (existingType.includes('BIGINT') && newTypeUpper === 'INT') ||
          (existingType.includes('TIMESTAMP') && newTypeUpper === 'DATE');

        findings.push({
          id: `finding-data-004-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: isDangerous ? 'CRITICAL' : 'HIGH',
          category: 'DATA_INTEGRITY',
          title: `Column '${stmt.columnName}' data type altered from '${existingType || 'existing'}' to '${stmt.newColumnType}'`,
          explanation: `Altering column data type from '${existingType || 'current type'}' to '${stmt.newColumnType}' causes a full table rewrite in PostgreSQL and risks runtime conversion failures or data truncation on incompatible values.`,
          affectedObject: `${tableKey}.${stmt.columnName}`,
          evidence: `Statement: "${stmt.rawSql}"${existingCol ? ` | Existing column: ${existingCol.dataType} (udt: ${existingCol.udtName})` : ''}`,
          recommendation:
            'Use a multi-phase migration: 1) Add new column with target type, 2) Dual-write / backfill data with validation, 3) Switch application reads to the new column, 4) Drop old column.',
        });
      }
    }

    return findings;
  }
}

/**
 * Rule: Foreign Key Missing Supporting Index
 * Detects adding a foreign key where referencing columns do not have a supporting index.
 */
export class ForeignKeyMissingIndexRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-005';
  public readonly name = 'Foreign Key Added Without Supporting Index';
  public readonly description =
    'Foreign key columns without an index cause full table sequential scans on the child table whenever rows in the parent table are deleted or updated.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'ADD_FOREIGN_KEY' && stmt.columns && stmt.columns.length > 0) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];

        // Check if an index exists whose leading columns match the foreign key columns
        const fkLeadingCol = stmt.columns[0];
        const hasSupportingIndex = inspection?.indexes.some((idx) => {
          const idxCols =
            idx.columnNames || (idx as unknown as { columns?: string[] }).columns || [];
          return idxCols[0] === fkLeadingCol;
        });

        if (!hasSupportingIndex && inspection) {
          const existingIndexNames = inspection.indexes
            .map((i) => i.indexName || (i as unknown as { name?: string }).name)
            .join(', ');
          findings.push({
            id: `finding-data-005-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'HIGH',
            category: 'DATA_INTEGRITY',
            title: `Foreign key on '${stmt.columns.join(', ')}' has no supporting index on '${tableKey}'`,
            explanation: `PostgreSQL does not automatically index foreign key columns. Without an index starting with '${fkLeadingCol}', any UPDATE or DELETE on referenced table '${stmt.referencedTable || 'parent'}' will trigger an expensive sequential scan on '${tableKey}', leading to severe locking and deadlock risks.`,
            affectedObject: tableKey,
            evidence: `Foreign Key statement: "${stmt.rawSql}" | Existing indexes on ${tableKey}: ${existingIndexNames || 'None'}`,
            recommendation: `Create a supporting index concurrently on the foreign key column(s): 'CREATE INDEX CONCURRENTLY idx_${stmt.tableName}_${stmt.columns.join('_')} ON ${tableKey} (${stmt.columns.join(', ')});'`,
          });
        }
      }
    }

    return findings;
  }
}

/**
 * Rule: Dropping Constraints
 * Detects removing constraints that enforce domain rules or referential integrity.
 */
export class DroppingConstraintRule implements MigrationAnalysisRule {
  public readonly ruleId = 'DATA-006';
  public readonly name = 'Dropping Table Constraint';
  public readonly description =
    'Dropping a constraint removes referential, uniqueness, or validation integrity guarantees from the database.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    _context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'DROP_CONSTRAINT' && stmt.constraintName) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;

        findings.push({
          id: `finding-data-006-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: 'MEDIUM',
          category: 'DATA_INTEGRITY',
          title: `Constraint '${stmt.constraintName}' dropped from table '${tableKey}'`,
          explanation: `Dropping constraint '${stmt.constraintName}' removes integrity rules from table '${tableKey}'. Subsequent write operations will no longer be validated against this constraint.`,
          affectedObject: `${tableKey}.${stmt.constraintName}`,
          evidence: `Statement: "${stmt.rawSql}"`,
          recommendation:
            'Confirm that upstream application layers enforce equivalent data validation or that the constraint is intentionally retired.',
        });
      }
    }

    return findings;
  }
}
