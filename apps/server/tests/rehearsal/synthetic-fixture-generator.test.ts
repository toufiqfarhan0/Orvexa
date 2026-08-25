import { describe, it, expect } from 'vitest';
import { SyntheticFixtureGenerator } from '../../src/rehearsal/utils/synthetic-fixture-generator.js';
import type { FullTableInspection } from '@orvexa/shared';

describe('SyntheticFixtureGenerator (Unit Tests)', () => {
  const mockTableInspections: FullTableInspection[] = [
    {
      table: {
        schemaName: 'public',
        tableName: 'users',
        tableType: 'BASE TABLE',
        estimatedRowCount: 20,
        totalSizeBytes: 32768,
        tableSizeBytes: 16384,
        indexSizeBytes: 16384,
        isPartitioned: false,
      },
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
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
        {
          columnName: 'email',
          ordinalPosition: 3,
          dataType: 'varchar',
          udtName: 'varchar',
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
        {
          columnName: 'role',
          ordinalPosition: 4,
          dataType: 'varchar',
          udtName: 'varchar',
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
      ],
      primaryKey: {
        name: 'users_pkey',
        schemaName: 'public',
        tableName: 'users',
        type: 'PRIMARY KEY',
        columnNames: ['id'],
        isDeferrable: false,
      },
      constraints: [
        {
          name: 'users_role_check',
          schemaName: 'public',
          tableName: 'users',
          type: 'CHECK',
          columnNames: ['role'],
          checkClause: "role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])",
          isDeferrable: false,
        },
      ],
      foreignKeys: [
        {
          name: 'users_organization_id_fkey',
          schemaName: 'public',
          tableName: 'users',
          type: 'FOREIGN KEY',
          columnNames: ['organization_id'],
          foreignSchemaName: 'public',
          foreignTableName: 'organizations',
          foreignColumnNames: ['id'],
          isDeferrable: false,
        },
      ],
      indexes: [],
      statistics: null,
    },
    {
      table: {
        schemaName: 'public',
        tableName: 'organizations',
        tableType: 'BASE TABLE',
        estimatedRowCount: 5,
        totalSizeBytes: 16384,
        tableSizeBytes: 8192,
        indexSizeBytes: 8192,
        isPartitioned: false,
      },
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
          columnName: 'name',
          ordinalPosition: 2,
          dataType: 'varchar',
          udtName: 'varchar',
          isNullable: false,
          isIdentity: false,
          isGenerated: false,
        },
      ],
      primaryKey: {
        name: 'organizations_pkey',
        schemaName: 'public',
        tableName: 'organizations',
        type: 'PRIMARY KEY',
        columnNames: ['id'],
        isDeferrable: false,
      },
      constraints: [],
      foreignKeys: [],
      indexes: [],
      statistics: null,
    },
  ];

  it('1. Topologically orders seed plans so parent tables are seeded before child tables', () => {
    const plans = SyntheticFixtureGenerator.generateSeedPlans(mockTableInspections, 2);
    expect(plans).toHaveLength(2);
    expect(plans[0].tableName).toBe('organizations');
    expect(plans[1].tableName).toBe('users');
  });

  it('2. Generates the exact requested number of deterministic rows per table', () => {
    const plans = SyntheticFixtureGenerator.generateSeedPlans(mockTableInspections, 3);
    expect(plans[0].insertStatements).toHaveLength(3);
    expect(plans[1].insertStatements).toHaveLength(3);
  });

  it('3. References parent primary key UUID in child foreign key column', () => {
    const plans = SyntheticFixtureGenerator.generateSeedPlans(mockTableInspections, 2);
    const orgInsert = plans[0].insertStatements[0];
    const userInsert = plans[1].insertStatements[0];

    expect(orgInsert).toContain('INSERT INTO "public"."organizations"');
    expect(userInsert).toContain('INSERT INTO "public"."users"');
    // Child user insert should contain parent org UUID
    expect(userInsert).toContain('00000000-0000-0000-0001-000000000001');
  });

  it('4. Respects check constraint options for enum-like string columns', () => {
    const plans = SyntheticFixtureGenerator.generateSeedPlans(mockTableInspections, 3);
    const userInsert = plans[1].insertStatements[0];
    expect(userInsert).toContain("'owner'");
  });
});
