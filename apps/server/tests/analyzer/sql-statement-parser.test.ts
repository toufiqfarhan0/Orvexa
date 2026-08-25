import { describe, it, expect } from 'vitest';
import { SqlStatementParser } from '../../src/analyzer/parser/sql-statement-parser.js';

describe('SqlStatementParser (Static PostgreSQL DDL Statement Parser)', () => {
  describe('splitStatements', () => {
    it('splits multiple statements separated by semicolons', () => {
      const sql = `
        CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);
        CREATE INDEX idx_users_email ON users(email);
        ALTER TABLE users ADD COLUMN age INT;
      `;
      const statements = SqlStatementParser.splitStatements(sql);
      expect(statements.length).toBe(3);
      expect(statements[0]).toContain('CREATE TABLE users');
      expect(statements[1]).toContain('CREATE INDEX idx_users_email');
      expect(statements[2]).toContain('ALTER TABLE users ADD COLUMN age');
    });

    it('ignores semicolons inside single-quoted string literals', () => {
      const sql =
        "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT 'Hello; World;'; ALTER TABLE users ADD COLUMN active BOOLEAN;";
      const statements = SqlStatementParser.splitStatements(sql);
      expect(statements.length).toBe(2);
      expect(statements[0]).toContain("DEFAULT 'Hello; World;'");
      expect(statements[1]).toContain('ADD COLUMN active');
    });

    it('ignores semicolons inside dollar-quoted code blocks ($$...$$)', () => {
      const sql = `
        CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TABLE logs (id INT);
      `;
      const statements = SqlStatementParser.splitStatements(sql);
      expect(statements.length).toBe(2);
      expect(statements[0]).toContain('LANGUAGE plpgsql');
      expect(statements[1]).toBe('CREATE TABLE logs (id INT)');
    });

    it('ignores semicolons inside single-line and multi-line comments', () => {
      const sql = `
        -- First statement comment; with semicolon
        CREATE TABLE events (id INT);
        /* Multi-line comment;
           with internal semicolons;
         */
        ALTER TABLE events ADD COLUMN name TEXT;
      `;
      const statements = SqlStatementParser.splitStatements(sql);
      expect(statements.length).toBe(2);
    });

    it('correctly handles statements containing string literals with double dashes (--)', () => {
      const sql = "ALTER TABLE events ADD COLUMN marker TEXT DEFAULT 'value -- not a comment';";
      const statements = SqlStatementParser.splitStatements(sql);
      expect(statements.length).toBe(1);
      expect(statements[0]).toContain("DEFAULT 'value -- not a comment'");
      expect(SqlStatementParser.hasExecutableContent(statements[0])).toBe(true);
    });

    it('correctly identifies empty or comment-only statements via hasExecutableContent', () => {
      expect(SqlStatementParser.hasExecutableContent('   -- Just a comment\n\n  ')).toBe(false);
      expect(SqlStatementParser.hasExecutableContent('   /* Multi-line comment only */  ')).toBe(
        false
      );
      expect(SqlStatementParser.hasExecutableContent('   \n\t  ')).toBe(false);
      expect(SqlStatementParser.hasExecutableContent('SELECT 1;')).toBe(true);
      expect(SqlStatementParser.hasExecutableContent("SELECT 'value -- inside string';")).toBe(
        true
      );
      expect(SqlStatementParser.hasExecutableContent('SELECT $$ block -- inside $$;')).toBe(true);
    });
  });

  describe('parseStatement & Operation Extraction', () => {
    it('parses CREATE TABLE with schema qualification and IF NOT EXISTS', () => {
      const stmt = SqlStatementParser.parseStatement(
        'CREATE TABLE IF NOT EXISTS analytics.events (id BIGINT PRIMARY KEY, payload JSONB);',
        0
      );
      expect(stmt.operationType).toBe('CREATE_TABLE');
      expect(stmt.schemaName).toBe('analytics');
      expect(stmt.tableName).toBe('events');
      expect(stmt.ifNotExists).toBe(true);
    });

    it('parses DROP TABLE with CASCADE and IF EXISTS', () => {
      const stmt = SqlStatementParser.parseStatement(
        'DROP TABLE IF EXISTS public.legacy_logs CASCADE;',
        1
      );
      expect(stmt.operationType).toBe('DROP_TABLE');
      expect(stmt.schemaName).toBe('public');
      expect(stmt.tableName).toBe('legacy_logs');
      expect(stmt.ifExists).toBe(true);
      expect(stmt.hasCascade).toBe(true);
    });

    it('parses TRUNCATE TABLE', () => {
      const stmt = SqlStatementParser.parseStatement('TRUNCATE TABLE orders CASCADE;', 0);
      expect(stmt.operationType).toBe('TRUNCATE_TABLE');
      expect(stmt.tableName).toBe('orders');
      expect(stmt.hasCascade).toBe(true);
    });

    it('parses CREATE INDEX CONCURRENTLY', () => {
      const stmt = SqlStatementParser.parseStatement(
        'CREATE INDEX CONCURRENTLY idx_users_org_id ON public.users (org_id, created_at);',
        0
      );
      expect(stmt.operationType).toBe('ADD_INDEX');
      expect(stmt.isConcurrent).toBe(true);
      expect(stmt.indexName).toBe('idx_users_org_id');
      expect(stmt.tableName).toBe('users');
      expect(stmt.columns).toEqual(['org_id', 'created_at']);
    });

    it('parses non-concurrent CREATE UNIQUE INDEX', () => {
      const stmt = SqlStatementParser.parseStatement(
        'CREATE UNIQUE INDEX idx_users_email ON users (email);',
        0
      );
      expect(stmt.operationType).toBe('ADD_INDEX');
      expect(stmt.isConcurrent).toBe(false);
      expect(stmt.indexName).toBe('idx_users_email');
      expect(stmt.tableName).toBe('users');
      expect(stmt.columns).toEqual(['email']);
    });

    it('parses DROP INDEX CONCURRENTLY', () => {
      const stmt = SqlStatementParser.parseStatement(
        'DROP INDEX CONCURRENTLY IF EXISTS idx_old_events;',
        0
      );
      expect(stmt.operationType).toBe('DROP_INDEX');
      expect(stmt.isConcurrent).toBe(true);
      expect(stmt.ifExists).toBe(true);
      expect(stmt.indexName).toBe('idx_old_events');
    });

    it('parses ALTER TABLE ADD COLUMN with NOT NULL and DEFAULT', () => {
      const stmt = SqlStatementParser.parseStatement(
        "ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL;",
        0
      );
      expect(stmt.operationType).toBe('ADD_COLUMN');
      expect(stmt.tableName).toBe('users');
      expect(stmt.columnName).toBe('status');
      expect(stmt.newColumnType).toBe('VARCHAR(50)');
      expect(stmt.isNotNull).toBe(true);
      expect(stmt.hasDefault).toBe(true);
      expect(stmt.defaultValue).toContain('ACTIVE');
    });

    it('parses ALTER TABLE ADD COLUMN with GENERATED ALWAYS AS', () => {
      const stmt = SqlStatementParser.parseStatement(
        'ALTER TABLE orders ADD COLUMN total_cents INT GENERATED ALWAYS AS (amount * 100) STORED;',
        0
      );
      expect(stmt.operationType).toBe('ADD_COLUMN');
      expect(stmt.isGenerated).toBe(true);
      expect(stmt.columnName).toBe('total_cents');
    });

    it('parses ALTER TABLE DROP COLUMN with CASCADE', () => {
      const stmt = SqlStatementParser.parseStatement(
        'ALTER TABLE users DROP COLUMN IF EXISTS deprecated_token CASCADE;',
        0
      );
      expect(stmt.operationType).toBe('DROP_COLUMN');
      expect(stmt.tableName).toBe('users');
      expect(stmt.columnName).toBe('deprecated_token');
      expect(stmt.hasCascade).toBe(true);
      expect(stmt.ifExists).toBe(true);
    });

    it('parses ALTER TABLE ALTER COLUMN TYPE', () => {
      const stmt = SqlStatementParser.parseStatement(
        'ALTER TABLE events ALTER COLUMN payload TYPE jsonb USING payload::jsonb;',
        0
      );
      expect(stmt.operationType).toBe('ALTER_COLUMN_TYPE');
      expect(stmt.tableName).toBe('events');
      expect(stmt.columnName).toBe('payload');
      expect(stmt.newColumnType).toBe('jsonb');
    });

    it('parses ALTER TABLE SET and DROP NOT NULL', () => {
      const setStmt = SqlStatementParser.parseStatement(
        'ALTER TABLE users ALTER COLUMN email SET NOT NULL;',
        0
      );
      expect(setStmt.operationType).toBe('SET_NOT_NULL');
      expect(setStmt.columnName).toBe('email');
      expect(setStmt.isNotNull).toBe(true);

      const dropStmt = SqlStatementParser.parseStatement(
        'ALTER TABLE users ALTER COLUMN nickname DROP NOT NULL;',
        1
      );
      expect(dropStmt.operationType).toBe('DROP_NOT_NULL');
      expect(dropStmt.columnName).toBe('nickname');
      expect(dropStmt.isNotNull).toBe(false);
    });

    it('parses ALTER TABLE ADD CONSTRAINT FOREIGN KEY with NOT VALID', () => {
      const stmt = SqlStatementParser.parseStatement(
        'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;',
        0
      );
      expect(stmt.operationType).toBe('ADD_FOREIGN_KEY');
      expect(stmt.tableName).toBe('orders');
      expect(stmt.constraintName).toBe('fk_orders_user');
      expect(stmt.columns).toEqual(['user_id']);
      expect(stmt.referencedTable).toBe('users');
      expect(stmt.referencedColumns).toEqual(['id']);
      expect(stmt.isNotValid).toBe(true);
    });

    it('parses ALTER TABLE ADD CONSTRAINT CHECK with NOT VALID', () => {
      const stmt = SqlStatementParser.parseStatement(
        'ALTER TABLE accounts ADD CONSTRAINT chk_balance_positive CHECK (balance >= 0) NOT VALID;',
        0
      );
      expect(stmt.operationType).toBe('ADD_CHECK_CONSTRAINT');
      expect(stmt.constraintName).toBe('chk_balance_positive');
      expect(stmt.isNotValid).toBe(true);
    });

    it('flags unrecognized SQL as UNSUPPORTED_OPERATION', () => {
      const stmt = SqlStatementParser.parseStatement(
        'DO $$ BEGIN RAISE NOTICE "Hello"; END $$;',
        0
      );
      expect(stmt.operationType).toBe('UNSUPPORTED_OPERATION');
    });
  });
});
