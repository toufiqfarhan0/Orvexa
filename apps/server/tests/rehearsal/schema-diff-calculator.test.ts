import { describe, it, expect } from 'vitest';
import { SchemaDiffCalculator } from '../../src/rehearsal/utils/schema-diff-calculator.js';
import type { FullTableInspection } from '@orvexa/shared';

describe('SchemaDiffCalculator (Unit Tests)', () => {
  const baseTable: FullTableInspection = {
    table: {
      schemaName: 'public',
      tableName: 'orders',
      tableType: 'BASE TABLE',
      estimatedRowCount: 100,
      totalSizeBytes: 32768,
      tableSizeBytes: 16384,
      indexSizeBytes: 16384,
      isPartitioned: false,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'bigint',
        udtName: 'int8',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'user_id',
        ordinalPosition: 2,
        dataType: 'uuid',
        udtName: 'uuid',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'amount',
        ordinalPosition: 3,
        dataType: 'numeric',
        udtName: 'numeric',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
    ],
    primaryKey: {
      name: 'orders_pkey',
      schemaName: 'public',
      tableName: 'orders',
      type: 'PRIMARY KEY',
      columnNames: ['id'],
      isDeferrable: false,
    },
    foreignKeys: [
      {
        name: 'fk_orders_user',
        schemaName: 'public',
        tableName: 'orders',
        type: 'FOREIGN KEY',
        columnNames: ['user_id'],
        foreignSchemaName: 'public',
        foreignTableName: 'users',
        foreignColumnNames: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
        isDeferrable: false,
      },
    ],
    constraints: [
      {
        name: 'check_positive_amount',
        schemaName: 'public',
        tableName: 'orders',
        type: 'CHECK',
        columnNames: ['amount'],
        checkClause: 'amount > 0',
        isDeferrable: false,
      },
    ],
    indexes: [
      {
        indexName: 'idx_orders_user_id',
        schemaName: 'public',
        tableName: 'orders',
        columnNames: ['user_id'],
        isUnique: false,
        isPrimary: false,
        isClustered: false,
        isValid: true,
        indexType: 'btree',
        indexDefinition: 'CREATE INDEX idx_orders_user_id ON orders(user_id)',
        sizeBytes: 8192,
      },
    ],
    statistics: null,
  };

  it('1. Detects added and removed tables', () => {
    const diff = SchemaDiffCalculator.calculateDiff([], [baseTable]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.tables.added).toHaveLength(1);
    expect(diff.tables.added[0].tableName).toBe('orders');
    expect(diff.summary).toContain('Added table "public"."orders"');
  });

  it('2. Detects modified column types and defaults', () => {
    const modifiedPost: FullTableInspection = {
      ...baseTable,
      columns: [
        baseTable.columns[0],
        baseTable.columns[1],
        {
          ...baseTable.columns[2],
          dataType: 'numeric(12,2)',
          columnDefault: '0.00',
        },
      ],
    };

    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [modifiedPost]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.columns.modified).toHaveLength(1);
    expect(diff.columns.modified[0].name).toBe('public.orders.amount');
    expect(diff.summary).toContain('Modified column "public.orders.amount"');
  });

  it('3. Detects modified primary key columns', () => {
    const modifiedPost: FullTableInspection = {
      ...baseTable,
      primaryKey: {
        ...baseTable.primaryKey!,
        columnNames: ['id', 'user_id'], // composite PK
      },
    };

    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [modifiedPost]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.primaryKeys.modified).toHaveLength(1);
    expect(diff.summary).toContain('Modified primary key on "public.orders"');
  });

  it('4. Detects modified foreign keys (e.g. onDelete changed from CASCADE to SET NULL)', () => {
    const modifiedPost: FullTableInspection = {
      ...baseTable,
      foreignKeys: [
        {
          ...baseTable.foreignKeys[0],
          onDelete: 'SET NULL',
        },
      ],
    };

    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [modifiedPost]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.foreignKeys.modified).toHaveLength(1);
    expect(diff.foreignKeys.modified[0].name).toBe('fk_orders_user');
    expect(diff.summary).toContain('Modified foreign key "fk_orders_user"');
  });

  it('5. Detects modified check constraints', () => {
    const modifiedPost: FullTableInspection = {
      ...baseTable,
      constraints: [
        {
          ...baseTable.constraints[0],
          checkClause: 'amount >= 0',
        },
      ],
    };

    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [modifiedPost]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.constraints.modified).toHaveLength(1);
    expect(diff.constraints.modified[0].name).toBe('check_positive_amount');
    expect(diff.summary).toContain('Modified constraint "check_positive_amount"');
  });

  it('6. Detects modified index properties (e.g. uniqueness or columns)', () => {
    const modifiedPost: FullTableInspection = {
      ...baseTable,
      indexes: [
        {
          ...baseTable.indexes[0],
          isUnique: true, // index altered to UNIQUE
        },
      ],
    };

    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [modifiedPost]);
    expect(diff.hasChanges).toBe(true);
    expect(diff.indexes.modified).toHaveLength(1);
    expect(diff.indexes.modified[0].name).toBe('idx_orders_user_id');
    expect(diff.summary).toContain('Modified index "idx_orders_user_id"');
  });

  it('7. Returns hasChanges=false when schemas are identical', () => {
    const diff = SchemaDiffCalculator.calculateDiff([baseTable], [baseTable]);
    expect(diff.hasChanges).toBe(false);
    expect(diff.summary).toHaveLength(0);
  });
});
