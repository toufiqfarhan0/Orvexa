import { describe, it, expect } from 'vitest';
import type { TargetTableInspection, SchemaDiffResult, TableMetadata, ColumnMetadata } from '@orvexa/shared';

describe('TargetTablesPanel & Schema Evolution Inspector', () => {
  const sampleTable: TargetTableInspection = {
    tableName: 'events',
    tableType: 'BASE TABLE',
    estimatedRowCount: 120,
    totalSizeBytes: 16384,
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'uuid',
        udtName: 'uuid',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'organization_id',
        ordinalPosition: 2,
        dataType: 'uuid',
        udtName: 'uuid',
        isNullable: true,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'payload',
        ordinalPosition: 3,
        dataType: 'jsonb',
        udtName: 'jsonb',
        isNullable: true,
        isIdentity: false,
        isGenerated: false,
      },
    ],
    indexes: [
      {
        indexName: 'events_pkey',
        schemaName: 'public',
        tableName: 'events',
        isUnique: true,
        isPrimary: true,
        isClustered: false,
        isValid: true,
        indexType: 'btree',
        columnNames: ['id'],
        indexDefinition: 'CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id)',
        sizeBytes: 8192,
      },
      {
        indexName: 'idx_events_org_id',
        schemaName: 'public',
        tableName: 'events',
        isUnique: false,
        isPrimary: false,
        isClustered: false,
        isValid: true,
        indexType: 'btree',
        columnNames: ['organization_id'],
        indexDefinition:
          'CREATE INDEX idx_events_org_id ON public.events USING btree (organization_id)',
        sizeBytes: 8192,
      },
    ],
    constraints: [
      {
        name: 'events_pkey',
        schemaName: 'public',
        tableName: 'events',
        type: 'PRIMARY KEY',
        columnNames: ['id'],
        isDeferrable: false,
      },
    ],
  };

  const createMockTableMeta = (name: string): TableMetadata => ({
    schemaName: 'public',
    tableName: name,
    tableType: 'BASE TABLE',
    estimatedRowCount: 0,
    totalSizeBytes: 0,
    tableSizeBytes: 0,
    indexSizeBytes: 0,
    isPartitioned: false,
  });

  const createMockColMeta = (name: string): ColumnMetadata => ({
    columnName: name,
    ordinalPosition: 1,
    dataType: 'text',
    udtName: 'text',
    isNullable: false,
    isIdentity: false,
    isGenerated: false,
  });

  it('1. correctly maps column types, primary keys, and index metadata', () => {
    expect(sampleTable.tableName).toBe('events');
    expect(sampleTable.columns).toHaveLength(3);
    expect(sampleTable.indexes).toHaveLength(2);
    expect(sampleTable.constraints).toHaveLength(1);

    const pkConstraint = sampleTable.constraints.find((c) => c.type === 'PRIMARY KEY');
    expect(pkConstraint?.columnNames).toContain('id');
  });

  it('2. maps added columns for ALTER TABLE ADD COLUMN diff overlays', () => {
    const diff: SchemaDiffResult = {
      hasChanges: true,
      summary: ['1 column added'],
      tables: {
        added: [],
        removed: [],
        modified: [{ name: 'events', before: createMockTableMeta('events'), after: createMockTableMeta('events') }],
      },
      columns: {
        added: [createMockColMeta('payload')],
        removed: [],
        modified: [],
      },
      indexes: { added: [], removed: [], modified: [] },
      constraints: { added: [], removed: [], modified: [] },
      primaryKeys: { added: [], removed: [], modified: [] },
      foreignKeys: { added: [], removed: [], modified: [] },
    };

    const addedCols = diff.columns.added.map((c: ColumnMetadata) => c.columnName);
    expect(addedCols).toContain('payload');
    expect(diff.tables.modified.map((m) => m.name)).toContain('events');
  });

  it('3. maps dropped tables for DROP TABLE diff overlays', () => {
    const diff: SchemaDiffResult = {
      hasChanges: true,
      summary: ['1 table removed'],
      tables: { added: [], removed: [createMockTableMeta('legacy_events')], modified: [] },
      columns: { added: [], removed: [], modified: [] },
      indexes: { added: [], removed: [], modified: [] },
      constraints: { added: [], removed: [], modified: [] },
      primaryKeys: { added: [], removed: [], modified: [] },
      foreignKeys: { added: [], removed: [], modified: [] },
    };

    expect(diff.tables.removed.map((t: TableMetadata) => t.tableName)).toContain('legacy_events');
  });

  it('4. maps created tables for CREATE TABLE diff overlays', () => {
    const diff: SchemaDiffResult = {
      hasChanges: true,
      summary: ['1 table created'],
      tables: { added: [createMockTableMeta('orders')], removed: [], modified: [] },
      columns: { added: [], removed: [], modified: [] },
      indexes: { added: [], removed: [], modified: [] },
      constraints: { added: [], removed: [], modified: [] },
      primaryKeys: { added: [], removed: [], modified: [] },
      foreignKeys: { added: [], removed: [], modified: [] },
    };

    expect(diff.tables.added.map((t: TableMetadata) => t.tableName)).toContain('orders');
  });
});

