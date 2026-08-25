import type { FullTableInspection, ColumnMetadata } from '@orvexa/shared';
import { validateIdentifier } from '../../db/utils/sanitizer.js';

export interface GeneratedDdlStatements {
  extensions: string[];
  schemas: string[];
  sequences: string[];
  tables: string[];
  primaryKeys: string[];
  constraints: string[];
  foreignKeys: string[];
  indexes: string[];
  allInOrder: string[];
}

/**
 * Generates deterministic, valid PostgreSQL DDL statements from inspected table metadata.
 */
export class SchemaDdlGenerator {
  /**
   * Transforms an array of FullTableInspection objects into executable DDL statements.
   */
  static generateDdl(tableInspections: FullTableInspection[]): GeneratedDdlStatements {
    const extensions = new Set<string>();
    const schemas = new Set<string>();
    const sequences = new Set<string>();
    const tables: string[] = [];
    const primaryKeys: string[] = [];
    const constraints: string[] = [];
    const foreignKeys: string[] = [];
    const indexes: string[] = [];

    // 1. Identify distinct schemas, sequences, and required extensions
    for (const inspection of tableInspections) {
      const schema = inspection.table.schemaName || 'public';
      if (schema !== 'public') {
        schemas.add(schema);
      }

      for (const col of inspection.columns) {
        if (col.columnDefault) {
          if (col.columnDefault.includes('uuid_generate_v4()')) {
            extensions.add('uuid-ossp');
          }
          // Extract sequence names referenced in nextval(...) defaults
          const nextvalMatch = col.columnDefault.match(/nextval\('([^']+)'/i);
          if (nextvalMatch && nextvalMatch[1]) {
            const rawSeq = nextvalMatch[1].replace(/^public\./, '').replace(/::.*$/, '');
            sequences.add(rawSeq);
          }
        }
      }
    }

    // 2. Generate CREATE TABLE statements
    for (const inspection of tableInspections) {
      const schema = validateIdentifier(inspection.table.schemaName || 'public', 'schemaName');
      const tableName = validateIdentifier(inspection.table.tableName, 'tableName');

      const columnDefs: string[] = inspection.columns
        .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
        .map((col) => this.formatColumnDefinition(col));

      const createTableSql = `CREATE TABLE IF NOT EXISTS "${schema}"."${tableName}" (\n  ${columnDefs.join(',\n  ')}\n);`;
      tables.push(createTableSql);

      const constraintNames = new Set<string>();

      // 3. Primary Key
      if (inspection.primaryKey && inspection.primaryKey.columnNames.length > 0) {
        const pkName = validateIdentifier(
          inspection.primaryKey.name || `${inspection.table.tableName}_pkey`,
          'pkName'
        );
        constraintNames.add(pkName);
        const cols = inspection.primaryKey.columnNames
          .map((c) => `"${validateIdentifier(c, 'columnName')}"`)
          .join(', ');
        primaryKeys.push(
          `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${pkName}" PRIMARY KEY (${cols});`
        );
      }

      // 4. Other Constraints (UNIQUE, CHECK)
      const nonPkConstraints = (inspection.constraints || []).filter(
        (c) => c.type !== 'PRIMARY KEY' && c.type !== 'FOREIGN KEY'
      );

      for (const c of nonPkConstraints) {
        const cName = validateIdentifier(c.name, 'constraintName');
        constraintNames.add(cName);
        if (c.type === 'UNIQUE' && c.columnNames.length > 0) {
          const cols = c.columnNames
            .map((col) => `"${validateIdentifier(col, 'columnName')}"`)
            .join(', ');
          constraints.push(
            `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${cName}" UNIQUE (${cols});`
          );
        } else if (c.type === 'CHECK' && c.checkClause) {
          // Normalize check clause wrapping
          let clause = c.checkClause.trim();
          if (clause.startsWith('CHECK')) {
            clause = clause.substring(5).trim();
          }
          if (clause.startsWith('(') && clause.endsWith(')')) {
            clause = clause.slice(1, -1);
          }
          constraints.push(
            `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${cName}" CHECK (${clause});`
          );
        }
      }

      // 5. Foreign Keys
      for (const fk of inspection.foreignKeys || []) {
        if (
          fk.columnNames.length > 0 &&
          fk.foreignTableName &&
          fk.foreignColumnNames &&
          fk.foreignColumnNames.length > 0
        ) {
          const fkName = validateIdentifier(
            fk.name || `${inspection.table.tableName}_fk`,
            'fkName'
          );
          constraintNames.add(fkName);
          const cols = fk.columnNames
            .map((col) => `"${validateIdentifier(col, 'columnName')}"`)
            .join(', ');
          const fSchema = validateIdentifier(fk.foreignSchemaName || 'public', 'foreignSchemaName');
          const fTable = validateIdentifier(fk.foreignTableName, 'foreignTableName');
          const fCols = fk.foreignColumnNames
            .map((col) => `"${validateIdentifier(col, 'foreignColumnName')}"`)
            .join(', ');

          let fkSql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${fkName}" FOREIGN KEY (${cols}) REFERENCES "${fSchema}"."${fTable}" (${fCols})`;
          if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
            fkSql += ` ON UPDATE ${fk.onUpdate}`;
          }
          if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
            fkSql += ` ON DELETE ${fk.onDelete}`;
          }
          fkSql += ';';
          foreignKeys.push(fkSql);
        }
      }

      // 6. Indexes (exclude primary key indexes and unique constraint backing indexes)
      const nonConstraintIndexes = (inspection.indexes || []).filter(
        (idx) => !idx.isPrimary && !constraintNames.has(idx.indexName)
      );

      for (const idx of nonConstraintIndexes) {
        if (idx.indexDefinition && idx.indexDefinition.trim().length > 0) {
          let def = idx.indexDefinition.trim();
          if (!def.endsWith(';')) {
            def += ';';
          }
          indexes.push(def);
        } else if (idx.columnNames.length > 0) {
          const idxName = validateIdentifier(idx.indexName, 'indexName');
          const cols = idx.columnNames
            .map((col) => `"${validateIdentifier(col, 'columnName')}"`)
            .join(', ');
          const uniqueClause = idx.isUnique ? 'UNIQUE ' : '';
          indexes.push(
            `CREATE ${uniqueClause}INDEX IF NOT EXISTS "${idxName}" ON "${schema}"."${tableName}" (${cols});`
          );
        }
      }
    }

    const extensionStatements = Array.from(extensions).map(
      (ext) => `CREATE EXTENSION IF NOT EXISTS "${ext}";`
    );
    const schemaStatements = Array.from(schemas).map(
      (sch) => `CREATE SCHEMA IF NOT EXISTS "${validateIdentifier(sch, 'schemaName')}";`
    );
    const sequenceStatements = Array.from(sequences).map(
      (seq) => `CREATE SEQUENCE IF NOT EXISTS "${validateIdentifier(seq, 'sequenceName')}";`
    );

    const allInOrder: string[] = [
      ...extensionStatements,
      ...schemaStatements,
      ...sequenceStatements,
      ...tables,
      ...primaryKeys,
      ...constraints,
      ...foreignKeys,
      ...indexes,
    ];

    return {
      extensions: extensionStatements,
      schemas: schemaStatements,
      sequences: sequenceStatements,
      tables,
      primaryKeys,
      constraints,
      foreignKeys,
      indexes,
      allInOrder,
    };
  }

  /**
   * Formats a single column definition into standard PostgreSQL DDL.
   */
  private static formatColumnDefinition(col: ColumnMetadata): string {
    const colName = validateIdentifier(col.columnName, 'columnName');
    let typeSql = this.mapDataType(col);

    if (col.columnDefault) {
      typeSql += ` DEFAULT ${col.columnDefault}`;
    }

    if (!col.isNullable) {
      typeSql += ' NOT NULL';
    }

    return `"${colName}" ${typeSql}`;
  }

  /**
   * Maps inspected column data type to PostgreSQL column type declaration.
   */
  private static mapDataType(col: ColumnMetadata): string {
    const dt = (col.dataType || '').toLowerCase();
    const udt = (col.udtName || '').toLowerCase();

    if (
      col.characterMaximumLength &&
      (dt.includes('varchar') || dt.includes('character varying'))
    ) {
      return `VARCHAR(${col.characterMaximumLength})`;
    }

    if (dt.includes('numeric') || dt.includes('decimal')) {
      if (col.numericPrecision !== undefined && col.numericScale !== undefined) {
        return `NUMERIC(${col.numericPrecision}, ${col.numericScale})`;
      }
    }

    if (dt === 'user-defined' && udt) {
      return udt.toUpperCase();
    }

    if (dt.includes('timestamp with time zone') || udt === 'timestamptz') {
      return 'TIMESTAMPTZ';
    }

    if (dt.includes('timestamp without time zone') || udt === 'timestamp') {
      return 'TIMESTAMP';
    }

    if (dt.includes('jsonb') || udt === 'jsonb') {
      return 'JSONB';
    }

    if (dt.includes('json') || udt === 'json') {
      return 'JSON';
    }

    if (dt.includes('uuid') || udt === 'uuid') {
      return 'UUID';
    }

    if (dt.includes('bigint') || dt.includes('int8') || udt === 'int8') {
      return 'BIGINT';
    }

    if (dt.includes('integer') || dt.includes('int4') || udt === 'int4') {
      return 'INTEGER';
    }

    if (dt.includes('smallint') || dt.includes('int2') || udt === 'int2') {
      return 'SMALLINT';
    }

    if (dt.includes('boolean') || dt.includes('bool') || udt === 'bool') {
      return 'BOOLEAN';
    }

    if (dt.includes('text') || udt === 'text') {
      return 'TEXT';
    }

    return col.dataType.toUpperCase();
  }
}
