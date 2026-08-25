import type { FullTableInspection, ColumnMetadata } from '@orvexa/shared';
import { validateIdentifier } from '../../db/utils/sanitizer.js';

export interface TableSeedPlan {
  schemaName: string;
  tableName: string;
  insertStatements: string[];
}

/**
 * Generates small, safe, deterministic synthetic fixture data for rehearsal databases.
 */
export class SyntheticFixtureGenerator {
  /**
   * Generates insert statements ordered topologically so parent foreign-key targets are seeded first.
   */
  static generateSeedPlans(
    tableInspections: FullTableInspection[],
    rowLimit: number = 3
  ): TableSeedPlan[] {
    const sortedInspections = this.topologicalSort(tableInspections);
    const plans: TableSeedPlan[] = [];

    // Track generated UUIDs per table for foreign-key referencing
    const generatedPks: Map<string, string[]> = new Map();

    for (const inspection of sortedInspections) {
      const schema = validateIdentifier(inspection.table.schemaName || 'public', 'schemaName');
      const table = validateIdentifier(inspection.table.tableName, 'tableName');
      const tableKey = `${schema}.${table}`;
      const insertStatements: string[] = [];
      const tablePkList: string[] = [];

      for (let rowIndex = 0; rowIndex < rowLimit; rowIndex++) {
        const columnsToInsert: string[] = [];
        const valuesToInsert: string[] = [];

        for (const col of inspection.columns) {
          const dt = (col.dataType || '').toLowerCase();
          const udt = (col.udtName || '').toLowerCase();
          const isPk = inspection.primaryKey?.columnNames.includes(col.columnName);

          // Check if this column is a foreign key
          const fk = inspection.foreignKeys?.find((f) => f.columnNames.includes(col.columnName));

          let val: string;

          if (fk && fk.foreignTableName) {
            const parentKey = `${fk.foreignSchemaName || 'public'}.${fk.foreignTableName}`;
            const parentIds = generatedPks.get(parentKey) || [];
            const parentId =
              parentIds[rowIndex % Math.max(parentIds.length, 1)] ||
              '00000000-0000-0000-0001-000000000001';
            val = `'${parentId}'`;
          } else if (isPk && (dt.includes('uuid') || udt === 'uuid')) {
            const hex = (rowIndex + 1).toString(16).padStart(4, '0');
            const genId = `00000000-0000-0000-0001-00000000${hex}`;
            tablePkList.push(genId);
            val = `'${genId}'`;
          } else {
            val = this.generateSampleValue(col, rowIndex, inspection);
          }

          columnsToInsert.push(`"${validateIdentifier(col.columnName, 'columnName')}"`);
          valuesToInsert.push(val);
        }

        const sql = `INSERT INTO "${schema}"."${table}" (${columnsToInsert.join(', ')}) VALUES (${valuesToInsert.join(', ')}) ON CONFLICT DO NOTHING;`;
        insertStatements.push(sql);
      }

      generatedPks.set(tableKey, tablePkList);
      plans.push({
        schemaName: schema,
        tableName: table,
        insertStatements,
      });
    }

    return plans;
  }

  /**
   * Topologically sorts tables based on foreign key dependencies.
   */
  private static topologicalSort(inspections: FullTableInspection[]): FullTableInspection[] {
    const result: FullTableInspection[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const map = new Map<string, FullTableInspection>();
    for (const insp of inspections) {
      map.set(insp.table.tableName, insp);
    }

    const visit = (tableName: string) => {
      if (visited.has(tableName)) return;
      if (temp.has(tableName)) {
        // Cycle detected: break cycle
        return;
      }

      temp.add(tableName);
      const insp = map.get(tableName);
      if (insp && insp.foreignKeys) {
        for (const fk of insp.foreignKeys) {
          if (fk.foreignTableName && map.has(fk.foreignTableName)) {
            visit(fk.foreignTableName);
          }
        }
      }

      temp.delete(tableName);
      visited.add(tableName);
      if (insp) {
        result.push(insp);
      }
    };

    for (const insp of inspections) {
      if (!visited.has(insp.table.tableName)) {
        visit(insp.table.tableName);
      }
    }

    return result;
  }

  /**
   * Generates a deterministic sample SQL literal for a column.
   */
  private static generateSampleValue(
    col: ColumnMetadata,
    rowIndex: number,
    inspection: FullTableInspection
  ): string {
    const dt = (col.dataType || '').toLowerCase();
    const udt = (col.udtName || '').toLowerCase();
    const colName = col.columnName.toLowerCase();

    // Check constraint values (e.g. role IN ('owner', 'admin', 'member'))
    const checkConstraint = inspection.constraints?.find(
      (c) => c.type === 'CHECK' && c.checkClause?.includes(col.columnName)
    );
    if (checkConstraint && checkConstraint.checkClause) {
      const match = checkConstraint.checkClause.match(/'([^']+)'/g);
      if (match && match.length > 0) {
        const option = match[rowIndex % match.length];
        return option; // already quoted
      }
    }

    if (dt.includes('bool') || udt === 'bool') {
      return rowIndex % 2 === 0 ? 'true' : 'false';
    }

    if (dt.includes('int') || dt.includes('serial') || udt.includes('int')) {
      return String((rowIndex + 1) * 10);
    }

    if (
      dt.includes('numeric') ||
      dt.includes('decimal') ||
      dt.includes('float') ||
      dt.includes('double')
    ) {
      return `${(rowIndex + 1) * 25}.50`;
    }

    if (dt.includes('uuid') || udt === 'uuid') {
      const hex = (rowIndex + 1).toString(16).padStart(4, '0');
      return `'00000000-0000-0000-0002-00000000${hex}'`;
    }

    if (dt.includes('json') || udt.includes('json')) {
      return `'{"fixtureIndex": ${rowIndex + 1}, "status": "active"}'::jsonb`;
    }

    if (dt.includes('timestamp') || dt.includes('date') || udt.includes('time')) {
      return `'2026-01-01 00:00:00+00'`;
    }

    if (colName.includes('email')) {
      return `'synthetic_user_${rowIndex + 1}@example.test'`;
    }

    if (colName.includes('slug')) {
      return `'test-slug-${rowIndex + 1}'`;
    }

    if (colName.includes('name')) {
      return `'Test Name ${rowIndex + 1}'`;
    }

    // Default string
    return `'sample_val_${rowIndex + 1}'`;
  }
}
