import { describe, it, expect } from 'vitest';
import { MigrationAnalyzerService } from '../../src/analyzer/services/migration-analyzer.service.js';
import type { ProposedMigration, FullTableInspection } from '@orvexa/shared';
import type { DatabaseAnalysisContext } from '../../src/analyzer/interfaces/migration-analyzer.interface.js';

describe('MigrationAnalyzerService (Static PostgreSQL Migration Analysis & Risk Assessment)', () => {
  const analyzer = new MigrationAnalyzerService();

  // Reusable sample table inspection for 'public.users'
  const usersTableInspection: FullTableInspection = {
    table: {
      schemaName: 'public',
      tableName: 'users',
      tableType: 'BASE TABLE',
      estimatedRowCount: 250000,
      totalSizeBytes: 45 * 1024 * 1024,
      tableSizeBytes: 30 * 1024 * 1024,
      indexSizeBytes: 15 * 1024 * 1024,
      isPartitioned: false,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'integer',
        udtName: 'int4',
        isNullable: false,
        isIdentity: true,
        isGenerated: false,
      },
      {
        columnName: 'email',
        ordinalPosition: 2,
        dataType: 'character varying(255)',
        udtName: 'varchar',
        isNullable: false,
        isIdentity: false,
        isGenerated: false,
      },
      {
        columnName: 'org_id',
        ordinalPosition: 3,
        dataType: 'integer',
        udtName: 'int4',
        isNullable: true,
        isIdentity: false,
        isGenerated: false,
      },
    ],
    primaryKey: {
      name: 'users_pkey',
      schemaName: 'public',
      tableName: 'users',
      type: 'PRIMARY KEY',
      columns: ['id'],
      definition: 'PRIMARY KEY (id)',
    },
    foreignKeys: [
      {
        name: 'fk_users_org',
        schemaName: 'public',
        tableName: 'users',
        type: 'FOREIGN KEY',
        columns: ['org_id'],
        foreignSchemaName: 'public',
        foreignTableName: 'organizations',
        foreignColumns: ['id'],
        definition: 'FOREIGN KEY (org_id) REFERENCES organizations(id)',
      },
    ],
    constraints: [],
    indexes: [
      {
        name: 'users_pkey',
        schemaName: 'public',
        tableName: 'users',
        isPrimary: true,
        isUnique: true,
        isValid: true,
        accessMethod: 'btree',
        columns: ['id'],
        definition: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)',
        sizeBytes: 8192,
      },
      {
        name: 'idx_users_email',
        schemaName: 'public',
        tableName: 'users',
        isPrimary: false,
        isUnique: true,
        isValid: true,
        accessMethod: 'btree',
        columns: ['email'],
        definition: 'CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email)',
        sizeBytes: 16384,
      },
    ],
    statistics: {
      schemaName: 'public',
      tableName: 'users',
      liveTuples: 250000,
      deadTuples: 500,
      vacuumCount: 12,
      autovacuumCount: 45,
      analyzeCount: 10,
      autoanalyzeCount: 30,
    },
  };

  // Reusable sample table inspection for 'public.orders'
  const ordersTableInspection: FullTableInspection = {
    table: {
      schemaName: 'public',
      tableName: 'orders',
      tableType: 'BASE TABLE',
      estimatedRowCount: 500000,
      totalSizeBytes: 120 * 1024 * 1024,
      tableSizeBytes: 80 * 1024 * 1024,
      indexSizeBytes: 40 * 1024 * 1024,
      isPartitioned: false,
    },
    columns: [
      {
        columnName: 'id',
        ordinalPosition: 1,
        dataType: 'bigint',
        udtName: 'int8',
        isNullable: false,
        isIdentity: true,
        isGenerated: false,
      },
      {
        columnName: 'user_id',
        ordinalPosition: 2,
        dataType: 'integer',
        udtName: 'int4',
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
      columns: ['id'],
      definition: 'PRIMARY KEY (id)',
    },
    foreignKeys: [
      {
        name: 'fk_orders_user',
        schemaName: 'public',
        tableName: 'orders',
        type: 'FOREIGN KEY',
        columns: ['user_id'],
        foreignSchemaName: 'public',
        foreignTableName: 'users',
        foreignColumns: ['id'],
        definition: 'FOREIGN KEY (user_id) REFERENCES users(id)',
      },
    ],
    constraints: [],
    indexes: [],
    statistics: {
      schemaName: 'public',
      tableName: 'orders',
      liveTuples: 500000,
      deadTuples: 1200,
      vacuumCount: 5,
      autovacuumCount: 20,
      analyzeCount: 8,
      autoanalyzeCount: 18,
    },
  };

  const defaultContext: DatabaseAnalysisContext = {
    server: {
      version: 'PostgreSQL 16.2',
      majorVersion: 16,
      serverEncoding: 'UTF8',
      maxConnections: 100,
    },
    tableInspections: {
      'public.users': usersTableInspection,
      'public.orders': ordersTableInspection,
    },
  };

  // Scenario 1: Safe CREATE INDEX CONCURRENTLY
  it('Scenario 1: Evaluates safe CREATE INDEX CONCURRENTLY with low risk', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-001',
      name: 'Add concurrent index on users org_id',
      rawSql: 'CREATE INDEX CONCURRENTLY idx_users_org_id ON users(org_id);',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    expect(output.parsedStatements.length).toBe(1);
    expect(output.parsedStatements[0]?.isConcurrent).toBe(true);
    expect(output.riskAssessment.lockAnalysis.lockMode).toBe('SHARE_UPDATE_EXCLUSIVE');
    expect(output.riskAssessment.lockAnalysis.blocksWrites).toBe(false);
    expect(output.riskAssessment.overallRiskLevel).toBe('LOW');
    expect(output.analysisResult.isSafeForSandbox).toBe(true);
  });

  // Scenario 2: Non-concurrent index on a large table
  it('Scenario 2: Flags non-concurrent CREATE INDEX on a large table with HIGH locking risk', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-002',
      name: 'Add non-concurrent index on large users table',
      rawSql: 'CREATE INDEX idx_users_org_id ON users(org_id);',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    expect(output.riskAssessment.lockAnalysis.lockMode).toBe('SHARE');
    expect(output.riskAssessment.lockAnalysis.blocksWrites).toBe(true);
    const lockFinding = output.analysisResult.findings.find((f) => f.ruleId === 'LOCK-001');
    expect(lockFinding).toBeDefined();
    expect(lockFinding?.severity).toBe('HIGH');
    expect(lockFinding?.explanation).toContain('acquires a SHARE lock');
  });

  // Scenario 3: Adding NOT NULL column without safe default/backfill
  it('Scenario 3: Flags adding NOT NULL column without default on non-empty table as CRITICAL', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-003',
      name: 'Add non-null column without default',
      rawSql: 'ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NOT NULL;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const integrityFinding = output.analysisResult.findings.find((f) => f.ruleId === 'DATA-001');
    expect(integrityFinding).toBeDefined();
    expect(integrityFinding?.severity).toBe('CRITICAL');
    expect(output.riskAssessment.overallRiskLevel).toBe('CRITICAL');
    expect(integrityFinding?.explanation).toContain('contains ~250,000 existing rows');
  });

  // Scenario 4: Adding a foreign key without supporting index
  it('Scenario 4: Flags adding foreign key without supporting index', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-004',
      name: 'Add foreign key without index',
      rawSql:
        'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id);',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const fkFinding = output.analysisResult.findings.find((f) => f.ruleId === 'DATA-005');
    expect(fkFinding).toBeDefined();
    expect(fkFinding?.severity).toBe('HIGH');
    expect(fkFinding?.explanation).toContain('sequential scan');
  });

  // Scenario 5: Dropping a referenced column
  it('Scenario 5: Flags dropping a column that is part of Primary Key or Foreign Key as CRITICAL', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-005',
      name: 'Drop primary key column',
      rawSql: 'ALTER TABLE users DROP COLUMN id;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const pkDropFinding = output.analysisResult.findings.find(
      (f) => f.ruleId === 'DATA-002' && f.id.includes('pk')
    );
    expect(pkDropFinding).toBeDefined();
    expect(pkDropFinding?.severity).toBe('CRITICAL');
    expect(output.riskAssessment.overallRiskLevel).toBe('CRITICAL');
  });

  // Scenario 6: Dropping a constraint
  it('Scenario 6: Flags dropping a constraint with MEDIUM risk', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-006',
      name: 'Drop foreign key constraint',
      rawSql: 'ALTER TABLE users DROP CONSTRAINT fk_users_org;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const dropFinding = output.analysisResult.findings.find((f) => f.ruleId === 'DATA-006');
    expect(dropFinding).toBeDefined();
    expect(dropFinding?.severity).toBe('MEDIUM');
  });

  // Scenario 7: Dropping a table with dependencies
  it('Scenario 7: Flags dropping table that is referenced by foreign keys from other tables as CRITICAL', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-007',
      name: 'Drop users table referenced by orders',
      rawSql: 'DROP TABLE users;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const tableDepFinding = output.analysisResult.findings.find((f) => f.ruleId === 'DATA-003');
    expect(tableDepFinding).toBeDefined();
    expect(tableDepFinding?.severity).toBe('CRITICAL');
    expect(tableDepFinding?.explanation).toContain("foreign key constraint 'fk_orders_user'");
  });

  // Scenario 8: Unsafe type alteration
  it('Scenario 8: Flags unsafe type alteration (VARCHAR to INT) as CRITICAL data integrity risk', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-008',
      name: 'Change email column to integer',
      rawSql: 'ALTER TABLE users ALTER COLUMN email TYPE integer;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const typeFinding = output.analysisResult.findings.find((f) => f.ruleId === 'DATA-004');
    expect(typeFinding).toBeDefined();
    expect(typeFinding?.severity).toBe('CRITICAL');
  });

  // Scenario 9: Destructive operation (TRUNCATE / DROP TABLE)
  it('Scenario 9: Flags TRUNCATE as destructive rollback risk', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-009',
      name: 'Truncate orders table',
      rawSql: 'TRUNCATE TABLE orders CASCADE;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const destrFinding = output.analysisResult.findings.find((f) => f.ruleId === 'ROLL-001');
    expect(destrFinding).toBeDefined();
    expect(destrFinding?.severity).toBe('CRITICAL');
    expect(destrFinding?.explanation).toContain('permanently deletes data');
  });

  // Scenario 10: Large-table ALTER TABLE
  it('Scenario 10: Flags heavy alteration on large table (>100k rows)', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-010',
      name: 'Alter column type on 500k row orders table',
      rawSql: 'ALTER TABLE orders ALTER COLUMN user_id TYPE bigint;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const perfFinding = output.analysisResult.findings.find((f) => f.ruleId === 'PERF-001');
    expect(perfFinding).toBeDefined();
    expect(perfFinding?.severity).toBe('HIGH');
    expect(perfFinding?.title).toContain('500,000 rows');
  });

  // Scenario 11: Unknown/unsupported statement
  it('Scenario 11: Flags unsupported procedural statement as a sandbox blocker', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-011',
      name: 'Unsupported PL/pgSQL block',
      rawSql: 'DO $$ BEGIN RAISE NOTICE "Testing"; END $$;',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    expect(output.analysisResult.isSafeForSandbox).toBe(false);
    expect(output.analysisResult.blockers.length).toBeGreaterThan(0);
    expect(output.analysisResult.blockers[0]).toContain('unsupported');
  });

  // Scenario 12: Multiple statements in one migration script
  it('Scenario 12: Correctly analyzes multi-statement scripts combining index and column additions', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-012',
      name: 'Multi-statement migration',
      rawSql: `
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT false NOT NULL;
        CREATE INDEX CONCURRENTLY idx_users_verified ON users(is_verified);
      `,
    };

    const output = await analyzer.analyze(migration, defaultContext);

    expect(output.parsedStatements.length).toBe(2);
    expect(output.parsedStatements[0]?.operationType).toBe('ADD_COLUMN');
    expect(output.parsedStatements[1]?.operationType).toBe('ADD_INDEX');
    expect(output.riskAssessment.lockAnalysis.lockMode).toBe('ACCESS_EXCLUSIVE');
  });

  // Scenario 13: Duplicate index detection
  it('Scenario 13: Detects duplicate/redundant index creation', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-013',
      name: 'Duplicate email index',
      rawSql: 'CREATE INDEX idx_users_email_duplicate ON users (email);',
    };

    const output = await analyzer.analyze(migration, defaultContext);

    const dupFinding = output.analysisResult.findings.find((f) => f.ruleId === 'PERF-002');
    expect(dupFinding).toBeDefined();
    expect(dupFinding?.title).toContain('redundant with existing index');
  });

  // Scenario 14: PostgreSQL version incompatibility
  it('Scenario 14: Flags generated columns on PostgreSQL < 12 as CRITICAL compatibility blocker', async () => {
    const oldPgContext: DatabaseAnalysisContext = {
      server: {
        version: 'PostgreSQL 11.8',
        majorVersion: 11,
        serverEncoding: 'UTF8',
      },
      tableInspections: {
        'public.orders': ordersTableInspection,
      },
    };

    const migration: ProposedMigration = {
      migrationId: 'mig-014',
      name: 'Add generated column on PG 11',
      rawSql:
        'ALTER TABLE orders ADD COLUMN total_cents INT GENERATED ALWAYS AS (amount * 100) STORED;',
    };

    const output = await analyzer.analyze(migration, oldPgContext);

    const compatFinding = output.analysisResult.findings.find((f) => f.ruleId === 'COMPAT-001');
    expect(compatFinding).toBeDefined();
    expect(compatFinding?.severity).toBe('CRITICAL');
    expect(compatFinding?.explanation).toContain('PostgreSQL 12');
    expect(output.analysisResult.isSafeForSandbox).toBe(false);
  });

  // Scenario 15: Deterministic identical output for identical input/context
  it('Scenario 15: Guarantees deterministic identical output for identical input and context', async () => {
    const migration: ProposedMigration = {
      migrationId: 'mig-015',
      name: 'Deterministic test migration',
      rawSql: `
        ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true NOT NULL;
        CREATE INDEX idx_users_active ON users (active);
      `,
    };

    const output1 = await analyzer.analyze(migration, defaultContext);
    const output2 = await analyzer.analyze(migration, defaultContext);

    expect(output1.riskAssessment.overallRiskLevel).toBe(output2.riskAssessment.overallRiskLevel);
    expect(output1.riskAssessment.overallScore).toBe(output2.riskAssessment.overallScore);
    expect(output1.analysisResult.findings.length).toBe(output2.analysisResult.findings.length);
    expect(output1.analysisResult.isSafeForSandbox).toBe(output2.analysisResult.isSafeForSandbox);
    expect(output1.riskAssessment.lockAnalysis.lockMode).toBe(
      output2.riskAssessment.lockAnalysis.lockMode
    );

    for (let i = 0; i < output1.analysisResult.findings.length; i++) {
      expect(output1.analysisResult.findings[i]?.ruleId).toBe(
        output2.analysisResult.findings[i]?.ruleId
      );
      expect(output1.analysisResult.findings[i]?.severity).toBe(
        output2.analysisResult.findings[i]?.severity
      );
      expect(output1.analysisResult.findings[i]?.category).toBe(
        output2.analysisResult.findings[i]?.category
      );
    }
  });
});
