import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';
import { PgInspectionAdapter } from '../../src/db/adapters/pg-inspection.adapter.js';
import { DisposablePostgresAdapter } from '../../src/rehearsal/adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalService } from '../../src/rehearsal/services/migration-rehearsal.service.js';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

describe('DisposablePostgresAdapter (Live PostgreSQL Integration Tests)', () => {
  let inspectionAdapter: PgInspectionAdapter;
  let disposableAdapter: DisposablePostgresAdapter;
  let rehearsalService: MigrationRehearsalService;
  const testRehearsalId = `it_test_${Date.now()}`;

  beforeAll(async () => {
    inspectionAdapter = new PgInspectionAdapter({ connectionString });
    disposableAdapter = new DisposablePostgresAdapter({ connectionString });
    rehearsalService = new MigrationRehearsalService({
      rehearsalDbPort: disposableAdapter,
      inspectionPort: inspectionAdapter,
    });
  });

  afterAll(async () => {
    try {
      await rehearsalService.cleanupRehearsal(testRehearsalId);
    } catch {
      // Ignored
    }
    await inspectionAdapter.close();
  });

  it('1. Provisions a disposable database, clones live schema, and seeds synthetic fixtures', async () => {
    const result = await rehearsalService.prepareRehearsal(testRehearsalId, {
      includeFixtures: true,
      fixtureRowLimit: 3,
    });

    expect(result.environment).toBeDefined();
    expect(result.environment.status).toBe('READY');
    expect(result.environment.databaseName).toBe(`rehearsal_${testRehearsalId}`);
    expect(result.cloneSummary.tablesCreated).toBeGreaterThanOrEqual(4);
    expect(result.cloneSummary.fixtureRowsInserted).toBeGreaterThanOrEqual(12);

    // Verify direct connection and querying inside the disposable database
    const rehearsalConfig = await rehearsalService.getConnectionConfig(testRehearsalId);
    const clientPool = new pg.Pool({
      host: rehearsalConfig.host,
      port: rehearsalConfig.port,
      user: rehearsalConfig.user,
      password: rehearsalConfig.password,
      database: rehearsalConfig.database,
      ssl: rehearsalConfig.ssl,
      max: 2,
    });

    try {
      const orgsRes = await clientPool.query('SELECT count(*) FROM organizations;');
      const usersRes = await clientPool.query('SELECT count(*) FROM users;');
      const eventsRes = await clientPool.query('SELECT count(*) FROM events;');
      const ordersRes = await clientPool.query('SELECT count(*) FROM orders;');

      expect(parseInt(orgsRes.rows[0].count, 10)).toBeGreaterThan(0);
      expect(parseInt(usersRes.rows[0].count, 10)).toBeGreaterThan(0);
      expect(parseInt(eventsRes.rows[0].count, 10)).toBeGreaterThan(0);
      expect(parseInt(ordersRes.rows[0].count, 10)).toBeGreaterThan(0);

      // Verify foreign key integrity by verifying joined query
      const joinRes = await clientPool.query(`
        SELECT u.id, u.email, o.name as org_name
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
      `);
      expect(joinRes.rows.length).toBeGreaterThan(0);
    } finally {
      await clientPool.end();
    }
  });

  it('2. Cleans up disposable database and verifies it no longer exists', async () => {
    await rehearsalService.cleanupRehearsal(testRehearsalId);

    const postEnv = await rehearsalService.getRehearsal(testRehearsalId);
    expect(postEnv).toBeNull();

    // Verify database was actually dropped on PostgreSQL
    const adminPool = new pg.Pool({
      connectionString,
      max: 2,
    });

    try {
      const res = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1;`, [
        `rehearsal_${testRehearsalId}`,
      ]);
      expect(res.rows.length).toBe(0);
    } finally {
      await adminPool.end();
    }
  });

  it('3. Cleanup is idempotent when called a second time', async () => {
    await expect(rehearsalService.cleanupRehearsal(testRehearsalId)).resolves.not.toThrow();
  });
});
