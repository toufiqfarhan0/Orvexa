import type {
  FullTableInspection,
  SchemaDiffResult,
  SchemaObjectDiff,
  TableMetadata,
  ColumnMetadata,
  ConstraintMetadata,
  IndexMetadata,
} from '@orvexa/shared';

/**
 * Calculates structured schema differences between pre-rehearsal and post-rehearsal database states.
 */
export class SchemaDiffCalculator {
  static calculateDiff(pre: FullTableInspection[], post: FullTableInspection[]): SchemaDiffResult {
    const summary: string[] = [];

    // 1. Table diffs
    const preTablesMap = new Map<string, TableMetadata>(
      pre.map((t) => [`${t.table.schemaName || 'public'}.${t.table.tableName}`, t.table])
    );
    const postTablesMap = new Map<string, TableMetadata>(
      post.map((t) => [`${t.table.schemaName || 'public'}.${t.table.tableName}`, t.table])
    );

    const tablesDiff: SchemaObjectDiff<TableMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [key, postTable] of postTablesMap) {
      if (!preTablesMap.has(key)) {
        tablesDiff.added.push(postTable);
        summary.push(`Added table "${postTable.schemaName}"."${postTable.tableName}"`);
      }
    }

    for (const [key, preTable] of preTablesMap) {
      if (!postTablesMap.has(key)) {
        tablesDiff.removed.push(preTable);
        summary.push(`Dropped table "${preTable.schemaName}"."${preTable.tableName}"`);
      }
    }

    // 2. Column diffs
    const preColsMap = new Map<string, ColumnMetadata>();
    for (const t of pre) {
      for (const col of t.columns) {
        preColsMap.set(
          `${t.table.schemaName || 'public'}.${t.table.tableName}.${col.columnName}`,
          col
        );
      }
    }

    const postColsMap = new Map<string, ColumnMetadata>();
    for (const t of post) {
      for (const col of t.columns) {
        postColsMap.set(
          `${t.table.schemaName || 'public'}.${t.table.tableName}.${col.columnName}`,
          col
        );
      }
    }

    const columnsDiff: SchemaObjectDiff<ColumnMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [key, postCol] of postColsMap) {
      if (!preColsMap.has(key)) {
        columnsDiff.added.push(postCol);
        summary.push(
          `Added column "${key}" (${postCol.dataType.toUpperCase()}${postCol.isNullable ? '' : ' NOT NULL'}${postCol.columnDefault ? ` DEFAULT ${postCol.columnDefault}` : ''})`
        );
      } else {
        const preCol = preColsMap.get(key)!;
        if (
          preCol.dataType !== postCol.dataType ||
          preCol.isNullable !== postCol.isNullable ||
          preCol.columnDefault !== postCol.columnDefault
        ) {
          columnsDiff.modified.push({
            name: key,
            before: preCol,
            after: postCol,
          });
          summary.push(`Modified column "${key}"`);
        }
      }
    }

    for (const [key, preCol] of preColsMap) {
      if (!postColsMap.has(key)) {
        columnsDiff.removed.push(preCol);
        summary.push(`Dropped column "${key}"`);
      }
    }

    // 3. Primary Key diffs
    const prePkMap = new Map<string, ConstraintMetadata>();
    for (const t of pre) {
      if (t.primaryKey) {
        prePkMap.set(`${t.table.schemaName || 'public'}.${t.table.tableName}`, t.primaryKey);
      }
    }

    const postPkMap = new Map<string, ConstraintMetadata>();
    for (const t of post) {
      if (t.primaryKey) {
        postPkMap.set(`${t.table.schemaName || 'public'}.${t.table.tableName}`, t.primaryKey);
      }
    }

    const primaryKeysDiff: SchemaObjectDiff<ConstraintMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [key, postPk] of postPkMap) {
      if (!prePkMap.has(key)) {
        primaryKeysDiff.added.push(postPk);
        summary.push(`Added primary key "${postPk.name}" on "${key}"`);
      } else {
        const prePk = prePkMap.get(key)!;
        const preCols = (prePk.columnNames || []).join(',');
        const postCols = (postPk.columnNames || []).join(',');
        if (preCols !== postCols || prePk.name !== postPk.name) {
          primaryKeysDiff.modified.push({
            name: key,
            before: prePk,
            after: postPk,
          });
          summary.push(`Modified primary key on "${key}"`);
        }
      }
    }
    for (const [key, prePk] of prePkMap) {
      if (!postPkMap.has(key)) {
        primaryKeysDiff.removed.push(prePk);
        summary.push(`Dropped primary key "${prePk.name}" from "${key}"`);
      }
    }

    // 4. Foreign Key diffs
    const preFkMap = new Map<string, ConstraintMetadata>();
    for (const t of pre) {
      for (const fk of t.foreignKeys || []) {
        preFkMap.set(fk.name, fk);
      }
    }

    const postFkMap = new Map<string, ConstraintMetadata>();
    for (const t of post) {
      for (const fk of t.foreignKeys || []) {
        postFkMap.set(fk.name, fk);
      }
    }

    const foreignKeysDiff: SchemaObjectDiff<ConstraintMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [name, postFk] of postFkMap) {
      if (!preFkMap.has(name)) {
        foreignKeysDiff.added.push(postFk);
        summary.push(`Added foreign key "${name}"`);
      } else {
        const preFk = preFkMap.get(name)!;
        const preCols = (preFk.columnNames || []).join(',');
        const postCols = (postFk.columnNames || []).join(',');
        const preRefCols = (preFk.foreignColumnNames || []).join(',');
        const postRefCols = (postFk.foreignColumnNames || []).join(',');

        if (
          preCols !== postCols ||
          preRefCols !== postRefCols ||
          preFk.foreignTableName !== postFk.foreignTableName ||
          preFk.onUpdate !== postFk.onUpdate ||
          preFk.onDelete !== postFk.onDelete
        ) {
          foreignKeysDiff.modified.push({
            name,
            before: preFk,
            after: postFk,
          });
          summary.push(`Modified foreign key "${name}"`);
        }
      }
    }
    for (const [name, preFk] of preFkMap) {
      if (!postFkMap.has(name)) {
        foreignKeysDiff.removed.push(preFk);
        summary.push(`Dropped foreign key "${name}"`);
      }
    }

    // 5. Constraints diffs
    const preConstraintsMap = new Map<string, ConstraintMetadata>();
    for (const t of pre) {
      for (const c of t.constraints || []) {
        if (c.type !== 'PRIMARY KEY' && c.type !== 'FOREIGN KEY') {
          preConstraintsMap.set(c.name, c);
        }
      }
    }

    const postConstraintsMap = new Map<string, ConstraintMetadata>();
    for (const t of post) {
      for (const c of t.constraints || []) {
        if (c.type !== 'PRIMARY KEY' && c.type !== 'FOREIGN KEY') {
          postConstraintsMap.set(c.name, c);
        }
      }
    }

    const constraintsDiff: SchemaObjectDiff<ConstraintMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [name, postC] of postConstraintsMap) {
      if (!preConstraintsMap.has(name)) {
        constraintsDiff.added.push(postC);
        summary.push(`Added constraint "${name}" (${postC.type})`);
      } else {
        const preC = preConstraintsMap.get(name)!;
        const preCols = (preC.columnNames || []).join(',');
        const postCols = (postC.columnNames || []).join(',');

        if (
          preC.type !== postC.type ||
          preCols !== postCols ||
          preC.checkClause !== postC.checkClause
        ) {
          constraintsDiff.modified.push({
            name,
            before: preC,
            after: postC,
          });
          summary.push(`Modified constraint "${name}"`);
        }
      }
    }
    for (const [name, preC] of preConstraintsMap) {
      if (!postConstraintsMap.has(name)) {
        constraintsDiff.removed.push(preC);
        summary.push(`Dropped constraint "${name}"`);
      }
    }

    // 6. Index diffs
    const preIdxMap = new Map<string, IndexMetadata>();
    for (const t of pre) {
      for (const idx of t.indexes || []) {
        if (!idx.isPrimary) {
          preIdxMap.set(idx.indexName, idx);
        }
      }
    }

    const postIdxMap = new Map<string, IndexMetadata>();
    for (const t of post) {
      for (const idx of t.indexes || []) {
        if (!idx.isPrimary) {
          postIdxMap.set(idx.indexName, idx);
        }
      }
    }

    const indexesDiff: SchemaObjectDiff<IndexMetadata> = {
      added: [],
      removed: [],
      modified: [],
    };

    for (const [name, postIdx] of postIdxMap) {
      if (!preIdxMap.has(name)) {
        indexesDiff.added.push(postIdx);
        summary.push(`Added index "${name}" on "${postIdx.schemaName}"."${postIdx.tableName}"`);
      } else {
        const preIdx = preIdxMap.get(name)!;
        const preCols = (preIdx.columnNames || []).join(',');
        const postCols = (postIdx.columnNames || []).join(',');

        if (
          preCols !== postCols ||
          preIdx.isUnique !== postIdx.isUnique ||
          preIdx.indexType !== postIdx.indexType ||
          preIdx.indexDefinition !== postIdx.indexDefinition
        ) {
          indexesDiff.modified.push({
            name,
            before: preIdx,
            after: postIdx,
          });
          summary.push(`Modified index "${name}"`);
        }
      }
    }
    for (const [name, preIdx] of preIdxMap) {
      if (!postIdxMap.has(name)) {
        indexesDiff.removed.push(preIdx);
        summary.push(`Dropped index "${name}"`);
      }
    }

    const hasChanges =
      tablesDiff.added.length > 0 ||
      tablesDiff.removed.length > 0 ||
      tablesDiff.modified.length > 0 ||
      columnsDiff.added.length > 0 ||
      columnsDiff.removed.length > 0 ||
      columnsDiff.modified.length > 0 ||
      primaryKeysDiff.added.length > 0 ||
      primaryKeysDiff.removed.length > 0 ||
      primaryKeysDiff.modified.length > 0 ||
      foreignKeysDiff.added.length > 0 ||
      foreignKeysDiff.removed.length > 0 ||
      foreignKeysDiff.modified.length > 0 ||
      constraintsDiff.added.length > 0 ||
      constraintsDiff.removed.length > 0 ||
      constraintsDiff.modified.length > 0 ||
      indexesDiff.added.length > 0 ||
      indexesDiff.removed.length > 0 ||
      indexesDiff.modified.length > 0;

    return {
      tables: tablesDiff,
      columns: columnsDiff,
      primaryKeys: primaryKeysDiff,
      foreignKeys: foreignKeysDiff,
      constraints: constraintsDiff,
      indexes: indexesDiff,
      hasChanges,
      summary,
    };
  }

  /**
   * Compares an actual live execution schema diff against an approved rehearsal schema diff.
   * Enforces structural parity across tables, columns, primary keys, foreign keys, constraints, and indexes.
   */
  static compareDiffs(
    actual: SchemaDiffResult,
    expected?: SchemaDiffResult
  ): { matches: boolean; mismatchReasons: string[] } {
    if (!expected) {
      // If no expected rehearsal diff exists, accept non-destructive changes if hasChanges matches
      return { matches: actual.hasChanges, mismatchReasons: [] };
    }

    const mismatchReasons: string[] = [];

    // 1. Compare tables
    const expectedAddedTables = (expected.tables?.added || [])
      .map((t) => `${t.schemaName || 'public'}.${t.tableName}`)
      .sort();
    const actualAddedTables = (actual.tables?.added || [])
      .map((t) => `${t.schemaName || 'public'}.${t.tableName}`)
      .sort();
    if (JSON.stringify(expectedAddedTables) !== JSON.stringify(actualAddedTables)) {
      mismatchReasons.push(
        `Added tables mismatch: expected [${expectedAddedTables.join(', ')}], found [${actualAddedTables.join(', ')}]`
      );
    }

    const expectedRemovedTables = (expected.tables?.removed || [])
      .map((t) => `${t.schemaName || 'public'}.${t.tableName}`)
      .sort();
    const actualRemovedTables = (actual.tables?.removed || [])
      .map((t) => `${t.schemaName || 'public'}.${t.tableName}`)
      .sort();
    if (JSON.stringify(expectedRemovedTables) !== JSON.stringify(actualRemovedTables)) {
      mismatchReasons.push(
        `Removed tables mismatch: expected [${expectedRemovedTables.join(', ')}], found [${actualRemovedTables.join(', ')}]`
      );
    }

    // 2. Compare columns
    const normalizeCol = (c: ColumnMetadata) =>
      `${c.columnName}:${(c.dataType || '').toLowerCase()}:${c.isNullable}:${c.columnDefault ?? ''}`;
    const expectedAddedCols = (expected.columns?.added || []).map(normalizeCol).sort();
    const actualAddedCols = (actual.columns?.added || []).map(normalizeCol).sort();
    if (JSON.stringify(expectedAddedCols) !== JSON.stringify(actualAddedCols)) {
      mismatchReasons.push(
        `Added columns mismatch: expected [${expectedAddedCols.join(', ')}], found [${actualAddedCols.join(', ')}]`
      );
    }

    const expectedRemovedCols = (expected.columns?.removed || []).map((c) => c.columnName).sort();
    const actualRemovedCols = (actual.columns?.removed || []).map((c) => c.columnName).sort();
    if (JSON.stringify(expectedRemovedCols) !== JSON.stringify(actualRemovedCols)) {
      mismatchReasons.push(
        `Removed columns mismatch: expected [${expectedRemovedCols.join(', ')}], found [${actualRemovedCols.join(', ')}]`
      );
    }

    const normalizeModCol = (m: { name: string; before: ColumnMetadata; after: ColumnMetadata }) =>
      `${m.name}:${(m.after?.dataType || '').toLowerCase()}:${m.after?.isNullable}:${m.after?.columnDefault ?? ''}`;
    const expectedModCols = (expected.columns?.modified || []).map(normalizeModCol).sort();
    const actualModCols = (actual.columns?.modified || []).map(normalizeModCol).sort();
    if (JSON.stringify(expectedModCols) !== JSON.stringify(actualModCols)) {
      mismatchReasons.push(
        `Modified columns mismatch: expected [${expectedModCols.join(', ')}], found [${actualModCols.join(', ')}]`
      );
    }

    // 3. Compare Primary Keys
    const expectedAddedPk = (expected.primaryKeys?.added || []).map((p) => p.name).sort();
    const actualAddedPk = (actual.primaryKeys?.added || []).map((p) => p.name).sort();
    if (JSON.stringify(expectedAddedPk) !== JSON.stringify(actualAddedPk)) {
      mismatchReasons.push(
        `Added primary keys mismatch: expected [${expectedAddedPk.join(', ')}], found [${actualAddedPk.join(', ')}]`
      );
    }

    const expectedRemovedPk = (expected.primaryKeys?.removed || []).map((p) => p.name).sort();
    const actualRemovedPk = (actual.primaryKeys?.removed || []).map((p) => p.name).sort();
    if (JSON.stringify(expectedRemovedPk) !== JSON.stringify(actualRemovedPk)) {
      mismatchReasons.push(
        `Removed primary keys mismatch: expected [${expectedRemovedPk.join(', ')}], found [${actualRemovedPk.join(', ')}]`
      );
    }

    // 4. Compare Foreign Keys
    const normalizeFk = (f: ConstraintMetadata) =>
      `${f.name}:${f.foreignTableName || ''}:${(f.columnNames || []).join(',')}`;
    const expectedAddedFk = (expected.foreignKeys?.added || []).map(normalizeFk).sort();
    const actualAddedFk = (actual.foreignKeys?.added || []).map(normalizeFk).sort();
    if (JSON.stringify(expectedAddedFk) !== JSON.stringify(actualAddedFk)) {
      mismatchReasons.push(
        `Added foreign keys mismatch: expected [${expectedAddedFk.join(', ')}], found [${actualAddedFk.join(', ')}]`
      );
    }

    const expectedRemovedFk = (expected.foreignKeys?.removed || []).map((f) => f.name).sort();
    const actualRemovedFk = (actual.foreignKeys?.removed || []).map((f) => f.name).sort();
    if (JSON.stringify(expectedRemovedFk) !== JSON.stringify(actualRemovedFk)) {
      mismatchReasons.push(
        `Removed foreign keys mismatch: expected [${expectedRemovedFk.join(', ')}], found [${actualRemovedFk.join(', ')}]`
      );
    }

    // 5. Compare Indexes
    const normalizeIdx = (i: IndexMetadata) =>
      `${i.indexName}:${i.tableName || ''}:${(i.columnNames || []).join(',')}`;
    const expectedAddedIdx = (expected.indexes?.added || []).map(normalizeIdx).sort();
    const actualAddedIdx = (actual.indexes?.added || []).map(normalizeIdx).sort();
    if (JSON.stringify(expectedAddedIdx) !== JSON.stringify(actualAddedIdx)) {
      mismatchReasons.push(
        `Added indexes mismatch: expected [${expectedAddedIdx.join(', ')}], found [${actualAddedIdx.join(', ')}]`
      );
    }

    const expectedRemovedIdx = (expected.indexes?.removed || []).map((i) => i.indexName).sort();
    const actualRemovedIdx = (actual.indexes?.removed || []).map((i) => i.indexName).sort();
    if (JSON.stringify(expectedRemovedIdx) !== JSON.stringify(actualRemovedIdx)) {
      mismatchReasons.push(
        `Removed indexes mismatch: expected [${expectedRemovedIdx.join(', ')}], found [${actualRemovedIdx.join(', ')}]`
      );
    }

    // 6. Overall change parity
    if (expected.hasChanges !== actual.hasChanges) {
      mismatchReasons.push(
        `Overall change flag mismatch: expected hasChanges=${expected.hasChanges}, actual hasChanges=${actual.hasChanges}`
      );
    }

    return {
      matches: mismatchReasons.length === 0,
      mismatchReasons,
    };
  }
}
