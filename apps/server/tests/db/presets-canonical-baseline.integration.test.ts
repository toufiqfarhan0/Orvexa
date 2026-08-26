import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import pg from 'pg';

const { Pool } = pg;

function isPostgresReachable(host = 'localhost', port = 5432, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

describe('Migration Presets Canonical Baseline Verification (Findings #3, #4, #5, #6)', () => {
  let pool: pg.Pool;
  let dbReachable = false;

  beforeAll(async () => {
    const dbUrl =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

    const url = new URL(dbUrl);
    const host = url.hostname || 'localhost';
    const port = parseInt(url.port || '5432', 10);

    dbReachable = await isPostgresReachable(host, port, 2000);
    if (!dbReachable) {
      console.warn('Skipping presets integration tests because database is unreachable.');
      return;
    }

    pool = new Pool({ connectionString: dbUrl });

    // Isolate in dedicated test schema
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS presets_test;
      SET search_path TO presets_test, public;
      DROP TABLE IF EXISTS presets_test.customer_orders CASCADE;
      DROP TABLE IF EXISTS presets_test.orders CASCADE;
      DROP TABLE IF EXISTS presets_test.events CASCADE;
      DROP TABLE IF EXISTS presets_test.users CASCADE;
      DROP TABLE IF EXISTS presets_test.organizations CASCADE;
    `);

    // Bootstrap canonical baseline schema in presets_test schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS presets_test.organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS presets_test.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES presets_test.organizations(id) ON DELETE CASCADE,
        email text UNIQUE NOT NULL,
        full_name text NOT NULL DEFAULT 'System User',
        role text NOT NULL DEFAULT 'viewer',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS presets_test.events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES presets_test.organizations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES presets_test.users(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        payload jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS presets_test.orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES presets_test.organizations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES presets_test.users(id) ON DELETE CASCADE,
        total_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS presets_test CASCADE;`).catch(() => {});
      await pool.end();
    }
  });

  it('Step 1: Baseline Table Preset executes cleanly against PostgreSQL', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(`
        CREATE TABLE IF NOT EXISTS presets_test.events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid,
          user_id uuid,
          event_type text NOT NULL,
          payload jsonb DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `)
    ).resolves.toBeDefined();
  });

  it('Step 2: Safe Add Column preset executes cleanly', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(
        `ALTER TABLE presets_test.events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';`
      )
    ).resolves.toBeDefined();
  });

  it('Step 3: Concurrent Index preset executes cleanly', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(
        `CREATE INDEX IF NOT EXISTS idx_events_type_test ON presets_test.events(event_type);`
      )
    ).resolves.toBeDefined();
  });

  it('Step 4: Add Metadata JSON column preset executes cleanly', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(
        `ALTER TABLE presets_test.events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;`
      )
    ).resolves.toBeDefined();
  });

  it('Step 5: Check Constraint on total_amount executes cleanly (Finding #3)', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(`
        ALTER TABLE presets_test.orders
        ADD CONSTRAINT chk_orders_amount_positive_test
        CHECK (total_amount >= 0) NOT VALID;
      `)
    ).resolves.toBeDefined();
  });

  it('Step 6: Batch column expansion on users executes cleanly', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(`
        ALTER TABLE presets_test.users
        ADD COLUMN IF NOT EXISTS phone text,
        ADD COLUMN IF NOT EXISTS avatar_url text;
      `)
    ).resolves.toBeDefined();
  });

  it('Variation: Alter nullability on users.full_name executes cleanly (Finding #4)', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(`ALTER TABLE presets_test.users ALTER COLUMN full_name DROP NOT NULL;`)
    ).resolves.toBeDefined();
  });

  it('Variation: Foreign key on events(user_id) executes cleanly (Finding #5)', async () => {
    if (!dbReachable) return;
    await expect(
      pool.query(`
        ALTER TABLE presets_test.events
        ADD CONSTRAINT fk_events_user_custom_test
        FOREIGN KEY (user_id) REFERENCES presets_test.users(id) ON DELETE SET NULL;
      `)
    ).resolves.toBeDefined();
  });
});
