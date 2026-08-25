import { describe, it, expect } from 'vitest';
import { PostgresTransactionClassifier } from '../../src/execution/utils/transaction-classifier.js';

describe('PostgresTransactionClassifier (Unit Tests)', () => {
  it('1. Correctly classifies standard transaction-safe DDL statements', () => {
    const safeStatements = [
      'CREATE TABLE users (id serial PRIMARY KEY, name text);',
      'ALTER TABLE users ADD COLUMN age int NOT NULL DEFAULT 18;',
      'DROP TABLE IF EXISTS old_logs CASCADE;',
      'CREATE INDEX idx_users_name ON users (name);',
      'DROP INDEX idx_old;',
      'REINDEX TABLE users;',
      'CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;',
      'DROP VIEW active_users;',
      "CREATE TYPE user_status AS ENUM ('active', 'inactive');",
      "ALTER TYPE user_status ADD VALUE 'pending';",
      'CREATE SEQUENCE seq_custom START 1;',
      'CREATE SCHEMA billing;',
      'CREATE OR REPLACE FUNCTION audit_trigger() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;',
      'CREATE TRIGGER trg_audit AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger();',
      "COMMENT ON TABLE users IS 'Core user accounts';",
      'GRANT SELECT ON users TO app_user;',
      "INSERT INTO settings (key, value) VALUES ('site_name', 'Orvexa');",
      "DO $$ BEGIN RAISE NOTICE 'Migration probe'; END $$;",
    ];

    for (const sql of safeStatements) {
      const classification = PostgresTransactionClassifier.classify(sql);
      expect(classification.category, `Expected TRANSACTION_SAFE for: ${sql}`).toBe(
        'TRANSACTION_SAFE'
      );
    }
  });

  it('2. Correctly classifies non-transactional statements that cannot run inside BEGIN...COMMIT', () => {
    const nonTxStatements = [
      'CREATE INDEX CONCURRENTLY idx_users_email ON users (email);',
      'CREATE UNIQUE INDEX CONCURRENTLY idx_users_uuid ON users (uuid);',
      'DROP INDEX CONCURRENTLY idx_users_email;',
      'REINDEX TABLE CONCURRENTLY users;',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY user_summary;',
      'VACUUM FULL users;',
      'VACUUM ANALYZE;',
      'CLUSTER users USING idx_users_pkey;',
      'CREATE DATABASE analytics_replica;',
      'DROP DATABASE old_analytics;',
      'ALTER SYSTEM SET max_connections = 200;',
      'DISCARD ALL;',
    ];

    for (const sql of nonTxStatements) {
      const classification = PostgresTransactionClassifier.classify(sql);
      expect(classification.category, `Expected NON_TRANSACTIONAL for: ${sql}`).toBe(
        'NON_TRANSACTIONAL'
      );
      expect(classification.reason).toBeDefined();
    }
  });

  it('3. Fails closed on manual transaction control and unsupported statements', () => {
    const unsupportedStatements = [
      'BEGIN;',
      'START TRANSACTION ISOLATION LEVEL SERIALIZABLE;',
      'COMMIT;',
      'END;',
      'ROLLBACK;',
      'SAVEPOINT my_savepoint;',
      'RELEASE SAVEPOINT my_savepoint;',
      'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
      'LISTEN table_update;',
      "NOTIFY channel_name, 'payload';",
      'COPY users FROM STDIN;',
      'FOOBAR UNKNOWN COMMAND;',
      '   ',
    ];

    for (const sql of unsupportedStatements) {
      const classification = PostgresTransactionClassifier.classify(sql);
      expect(classification.category, `Expected UNSUPPORTED for: "${sql}"`).toBe('UNSUPPORTED');
      expect(classification.reason).toBeDefined();
    }
  });

  it('4. Classifies statement batches and detects mixed non-transactional statements', () => {
    const batchResult = PostgresTransactionClassifier.classifyBatch([
      'ALTER TABLE users ADD COLUMN age int;',
      'CREATE INDEX CONCURRENTLY idx_users_age ON users (age);',
    ]);

    expect(batchResult.valid).toBe(true);
    expect(batchResult.hasNonTransactional).toBe(true);
    expect(batchResult.allTransactionSafe).toBe(false);
  });

  it('5. Rejects batch if any statement is unsupported', () => {
    const batchResult = PostgresTransactionClassifier.classifyBatch([
      'ALTER TABLE users ADD COLUMN age int;',
      'BEGIN;',
      'CREATE TABLE test (id int);',
    ]);

    expect(batchResult.valid).toBe(false);
    expect(batchResult.unsupportedReasons.length).toBeGreaterThan(0);
  });
});
