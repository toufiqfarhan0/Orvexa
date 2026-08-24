import { describe, it, expect } from 'vitest';
import {
  sanitizeConnectionString,
  sanitizeErrorMessage,
  validateIdentifier,
  parsePgArray,
} from '../../src/db/utils/sanitizer.js';
import { InvalidInspectionRequestError } from '../../src/db/errors/postgres.errors.js';

describe('PostgreSQL Utility & Sanitizer', () => {
  describe('sanitizeConnectionString', () => {
    it('redacts password from standard postgresql:// URI', () => {
      const input =
        'postgresql://admin_user:SuperSecretPassword123!@db.internal.aws:5432/production_db';
      const output = sanitizeConnectionString(input);

      expect(output).not.toContain('SuperSecretPassword123!');
      expect(output).toContain('admin_user');
      expect(output).toContain('db.internal.aws:5432');
      expect(output).toContain('production_db');
      expect(output).toContain('***');
    });

    it('redacts password from postgres:// URI prefix', () => {
      const input = 'postgres://root:p%40ssw0rd@10.0.0.1:5432/app_db?sslmode=require';
      const output = sanitizeConnectionString(input);

      expect(output).not.toContain('p%40ssw0rd');
      expect(output).toContain('***');
    });

    it('leaves URIs without password intact', () => {
      const input = 'postgresql://localhost:5432/local_db';
      const output = sanitizeConnectionString(input);

      expect(output).toBe('postgresql://localhost:5432/local_db');
    });

    it('redacts key-value connection strings with password parameter', () => {
      const input = 'host=localhost port=5432 user=pguser password=MySecretPass dbname=testdb';
      const output = sanitizeConnectionString(input);

      expect(output).not.toContain('MySecretPass');
      expect(output).toContain('password=***');
      expect(output).toContain('host=localhost');
    });

    it('returns placeholder for empty or invalid input', () => {
      expect(sanitizeConnectionString('')).toBe('[EMPTY_CONNECTION_STRING]');
      expect(sanitizeConnectionString(null as unknown as string)).toBe('[EMPTY_CONNECTION_STRING]');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('strips credentials embedded in driver error messages', () => {
      const rawError =
        'error: password authentication failed for user "postgres" on postgresql://postgres:MyPlaintextSecret@localhost:5432/test';
      const sanitized = sanitizeErrorMessage(rawError);

      expect(sanitized).not.toContain('MyPlaintextSecret');
      expect(sanitized).toContain('***');
    });

    it('returns fallback on empty message', () => {
      expect(sanitizeErrorMessage('')).toBe('Unknown database error');
    });
  });

  describe('validateIdentifier', () => {
    it('accepts valid PostgreSQL identifiers', () => {
      expect(validateIdentifier('public', 'schemaName')).toBe('public');
      expect(validateIdentifier('users', 'tableName')).toBe('users');
      expect(validateIdentifier('user_order_items_v2', 'tableName')).toBe('user_order_items_v2');
      expect(validateIdentifier('_audit_log', 'tableName')).toBe('_audit_log');
      expect(validateIdentifier('order$items', 'tableName')).toBe('order$items');
    });

    it('rejects SQL injection attempts in identifier parameters', () => {
      expect(() => validateIdentifier('users; DROP TABLE orders;', 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
      expect(() => validateIdentifier("users' OR 1=1--", 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
      expect(() => validateIdentifier('public.users', 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
    });

    it('rejects identifiers starting with digits or containing invalid characters', () => {
      expect(() => validateIdentifier('123table', 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
      expect(() => validateIdentifier('user-table', 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
      expect(() => validateIdentifier('user table', 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
    });

    it('rejects identifiers exceeding 63 bytes', () => {
      const oversizedName = 'a'.repeat(64);
      expect(() => validateIdentifier(oversizedName, 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
    });

    it('rejects empty or non-string identifiers', () => {
      expect(() => validateIdentifier('', 'tableName')).toThrow(InvalidInspectionRequestError);
      expect(() => validateIdentifier(null as unknown as string, 'tableName')).toThrow(
        InvalidInspectionRequestError
      );
    });
  });

  describe('parsePgArray', () => {
    it('parses PostgreSQL array strings correctly', () => {
      expect(parsePgArray('{id}')).toEqual(['id']);
      expect(parsePgArray('{id,organization_id,created_at}')).toEqual([
        'id',
        'organization_id',
        'created_at',
      ]);
      expect(parsePgArray('{"user_id","role"}')).toEqual(['user_id', 'role']);
    });

    it('handles native arrays and falsy/empty values', () => {
      expect(parsePgArray(['id', 'email'])).toEqual(['id', 'email']);
      expect(parsePgArray('{}')).toEqual([]);
      expect(parsePgArray('')).toEqual([]);
      expect(parsePgArray(null)).toEqual([]);
      expect(parsePgArray(undefined)).toEqual([]);
    });
  });
});
