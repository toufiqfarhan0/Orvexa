import pg from 'pg';
import { createApp } from './app.js';
import { config } from './config/env.js';

const { Pool } = pg;

async function bootstrapDatabase(): Promise<void> {
  if (!config.databaseUrl) return;
  try {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5000,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        email text UNIQUE NOT NULL,
        full_name text NOT NULL DEFAULT 'System User',
        role text NOT NULL DEFAULT 'viewer',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        payload jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        total_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await pool.end();
    console.info('[server] Baseline database tables verified/initialized.');
  } catch (err) {
    console.warn(
      '[server] Baseline database bootstrap skipped or non-fatal:',
      err instanceof Error ? err.message : err
    );
  }
}

const app = createApp();

const server = app.listen(config.port, () => {
  console.info(
    `[server] ${config.serviceName} v${config.version} running on http://localhost:${config.port}`
  );
  console.info(`[server] Health check available at http://localhost:${config.port}/api/health`);
  void bootstrapDatabase();
});

const shutdown = (signal: string) => {
  console.info(`[server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.info('[server] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
