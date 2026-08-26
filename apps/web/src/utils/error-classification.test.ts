import { describe, it, expect } from 'vitest';
import {
  isMissingRelationError,
  extractMissingRelationName,
  isMissingColumnError,
  extractMissingColumnDetails,
} from './error-classification.js';

describe('Error Classification Utility (Finding #7)', () => {
  it('correctly identifies missing relation and table errors', () => {
    expect(isMissingRelationError('relation "public.events" does not exist')).toBe(true);
    expect(isMissingRelationError('relation "events" does not exist')).toBe(true);
    expect(isMissingRelationError('table "orders" does not exist')).toBe(true);
    expect(isMissingRelationError('table "users" not found')).toBe(true);
  });

  it('extracts missing relation name accurately', () => {
    expect(extractMissingRelationName('relation "public.events" does not exist')).toBe(
      'public.events'
    );
    expect(extractMissingRelationName('relation "events" does not exist')).toBe('events');
    expect(extractMissingRelationName('table "orders" does not exist')).toBe('orders');
  });

  it('rejects missing column errors from being misclassified as missing table', () => {
    expect(isMissingRelationError('column "total_amount" does not exist')).toBe(false);
    expect(isMissingRelationError('column "status" of relation "events" does not exist')).toBe(
      false
    );
    expect(isMissingRelationError('column "full_name" does not exist')).toBe(false);
  });

  it('correctly identifies missing column errors', () => {
    expect(isMissingColumnError('column "total_amount" does not exist')).toBe(true);
    expect(isMissingColumnError('column "status" of relation "events" does not exist')).toBe(true);
  });

  it('extracts missing column details accurately', () => {
    const details1 = extractMissingColumnDetails('column "total_amount" does not exist');
    expect(details1.isMissingColumn).toBe(true);
    expect(details1.columnName).toBe('total_amount');

    const details2 = extractMissingColumnDetails(
      'column "status" of relation "events" does not exist'
    );
    expect(details2.isMissingColumn).toBe(true);
    expect(details2.columnName).toBe('status');
    expect(details2.relationName).toBe('events');
  });

  it('rejects missing constraint, type, database, schema, or unrelated syntax errors', () => {
    expect(isMissingRelationError('constraint "chk_amount" does not exist')).toBe(false);
    expect(isMissingRelationError('type "user_role" does not exist')).toBe(false);
    expect(isMissingRelationError('database "orvexa_db" does not exist')).toBe(false);
    expect(isMissingRelationError('schema "private" does not exist')).toBe(false);
    expect(isMissingRelationError('syntax error at or near "SELECT"')).toBe(false);
    expect(isMissingRelationError('')).toBe(false);
    expect(isMissingRelationError(undefined)).toBe(false);
  });
});
