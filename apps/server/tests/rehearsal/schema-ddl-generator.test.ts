import { describe, it, expect } from 'vitest';
import { SchemaDdlGenerator } from '../../src/rehearsal/utils/schema-ddl-generator.js';
import type { FullTableInspection } from '@orvexa/shared';

describe('SchemaDdlGenerator (Unit Tests)', () => {
  const mockTableInspections: FullTableInspection[] = [
    {
      table: {
        schemaName: 'public',
        tableName: 'organizations',
        tableType: 'BASE TABLE',
        estimatedRowCount: 10,
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
          columnDefault: 'uuid_generate_v4()',
          isIdentity: false,
          isGenerated: false,
        },
        {
          columnName: 'name',
          ordinalPosition: 2,
          dataType: 'character varying',
          udtName: 'varchar',
          isNullable: false,
          characterMaximumLength: 255,
          isIdentity: false,
          isGenerated: false,
        },
        {
          columnName: 'plan',
          ordinalPosition: 3,
          dataType: 'character varying',
          udtName: 'varchar',
          isNullable: false,
          characterMaximumLength: 50,
          columnDefault: "'starter'::character varying",
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
      constraints: [
        {
          name: 'organizations_plan_check',
          schemaName: 'public',
          tableName: 'organizations',
          type: 'CHECK',
          columnNames: ['plan'],
          checkClause: "plan = ANY (ARRAY['starter'::text, 'pro'::text, 'enterprise'::text])",
          isDeferrable: false,
        },
      ],
      foreignKeys: [],
      indexes: [
        {
          indexName: 'organizations_pkey',
          schemaName: 'public',
          tableName: 'organizations',
          isUnique: true,
          isPrimary: true,
          isClustered: false,
          isValid: true,
          indexType: 'btree',
          columnNames: ['id'],
          indexDefinition:
            'CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id)',
          sizeBytes: 8192,
        },
        {
          indexName: 'idx_organizations_name',
          schemaName: 'public',
          tableName: 'organizations',
          isUnique: false,
          isPrimary: false,
          isClustered: false,
          isValid: true,
          indexType: 'btree',
          columnNames: ['name'],
          indexDefinition:
            'CREATE INDEX idx_organizations_name ON public.organizations USING btree (name)',
          sizeBytes: 8192,
        },
      ],
      statistics: null,
    },
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
          columnDefault: 'uuid_generate_v4()',
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
          dataType: 'character varying',
          udtName: 'varchar',
          isNullable: false,
          characterMaximumLength: 255,
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
          name: 'users_email_key',
          schemaName: 'public',
          tableName: 'users',
          type: 'UNIQUE',
          columnNames: ['email'],
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
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          isDeferrable: false,
        },
      ],
      indexes: [
        {
          indexName: 'idx_users_org_id',
          schemaName: 'public',
          tableName: 'users',
          isUnique: false,
          isPrimary: false,
          isClustered: false,
          isValid: true,
          indexType: 'btree',
          columnNames: ['organization_id'],
          indexDefinition:
            'CREATE INDEX idx_users_org_id ON public.users USING btree (organization_id)',
          sizeBytes: 8192,
        },
      ],
      statistics: null,
    },
  ];

  it('1. Detects required extensions from column defaults', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.extensions).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  });

  it('2. Generates formatted CREATE TABLE statements with correct column types', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.tables).toHaveLength(2);

    expect(ddl.tables[0]).toContain('CREATE TABLE IF NOT EXISTS "public"."organizations"');
    expect(ddl.tables[0]).toContain('"name" VARCHAR(255) NOT NULL');
    expect(ddl.tables[0]).toContain(
      '"plan" VARCHAR(50) DEFAULT \'starter\'::character varying NOT NULL'
    );

    expect(ddl.tables[1]).toContain('CREATE TABLE IF NOT EXISTS "public"."users"');
    expect(ddl.tables[1]).toContain('"organization_id" UUID NOT NULL');
  });

  it('3. Generates primary key constraints', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.primaryKeys).toContain(
      'ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");'
    );
    expect(ddl.primaryKeys).toContain(
      'ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");'
    );
  });

  it('4. Generates unique and check constraints', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.constraints).toContain(
      'ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_plan_check" CHECK (plan = ANY (ARRAY[\'starter\'::text, \'pro\'::text, \'enterprise\'::text]));'
    );
    expect(ddl.constraints).toContain(
      'ALTER TABLE "public"."users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");'
    );
  });

  it('5. Generates foreign key constraints with ON UPDATE / ON DELETE actions', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.foreignKeys).toContain(
      'ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE CASCADE ON DELETE CASCADE;'
    );
  });

  it('6. Generates secondary indexes while excluding primary key auto-indexes', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.indexes).toHaveLength(2);
    expect(ddl.indexes).toContain(
      'CREATE INDEX idx_organizations_name ON public.organizations USING btree (name);'
    );
    expect(ddl.indexes).toContain(
      'CREATE INDEX idx_users_org_id ON public.users USING btree (organization_id);'
    );
  });

  it('7. Combines all DDL statements in strict dependency order', () => {
    const ddl = SchemaDdlGenerator.generateDdl(mockTableInspections);
    expect(ddl.allInOrder.length).toBeGreaterThan(6);

    const extIndex = ddl.allInOrder.findIndex((s) => s.startsWith('CREATE EXTENSION'));
    const tableIndex = ddl.allInOrder.findIndex((s) => s.startsWith('CREATE TABLE'));
    const pkIndex = ddl.allInOrder.findIndex((s) => s.includes('PRIMARY KEY'));
    const fkIndex = ddl.allInOrder.findIndex((s) => s.includes('FOREIGN KEY'));

    expect(extIndex).toBeLessThan(tableIndex);
    expect(tableIndex).toBeLessThan(pkIndex);
    expect(pkIndex).toBeLessThan(fkIndex);
  });
});
