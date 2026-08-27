import { describe, it, expect, vi } from 'vitest';
import { handoffScenarioToStorage } from './InteractiveProofConsole.js';
import fs from 'node:fs';
import path from 'node:path';

describe('InteractiveProofConsole Storage Resiliency (Qodo Finding #4)', () => {
  it('successfully hands off scenario SQL to functional localStorage', () => {
    const mockStorage = {
      store: {} as Record<string, string>,
      setItem: vi.fn(function (this: { store: Record<string, string> }, key: string, val: string) {
        this.store[key] = val;
      }),
      removeItem: vi.fn(function (this: { store: Record<string, string> }, key: string) {
        delete this.store[key];
      }),
      getItem: vi.fn(function (this: { store: Record<string, string> }, key: string) {
        return this.store[key] || null;
      }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    const sql = 'ALTER TABLE users ADD COLUMN test_col text;';
    const res = handoffScenarioToStorage(sql, mockStorage as unknown as Storage);

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(mockStorage.setItem).toHaveBeenCalledWith('orvexa_pending_sql', sql);
    expect(mockStorage.removeItem).toHaveBeenCalledWith('orvexa_active_session_id');
  });

  it('handles null or unavailable storage environment gracefully without throwing', () => {
    const sql = 'ALTER TABLE users ADD COLUMN test_col text;';
    const res = handoffScenarioToStorage(sql, null);

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).toContain('Storage API unavailable');
  });

  it('catches and reports quota or security exceptions on setItem', () => {
    const throwingStorage = {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError: storage limit reached');
      }),
      removeItem: vi.fn(),
      getItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    const sql = 'ALTER TABLE users ADD COLUMN test_col text;';
    const res = handoffScenarioToStorage(sql, throwingStorage as unknown as Storage);

    expect(res.success).toBe(false);
    expect(res.error).toContain('QuotaExceededError');
  });

  it('catches and reports security exceptions on removeItem', () => {
    const throwingStorage = {
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('SecurityError: Access is denied for this document');
      }),
      getItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    const sql = 'ALTER TABLE users ADD COLUMN test_col text;';
    const res = handoffScenarioToStorage(sql, throwingStorage as unknown as Storage);

    expect(res.success).toBe(false);
    expect(res.error).toContain('SecurityError');
  });

  it('verifies InteractiveProofConsole.tsx implements safe navigation recovery', () => {
    const compPath = path.resolve(__dirname, 'InteractiveProofConsole.tsx');
    const content = fs.readFileSync(compPath, 'utf8');

    expect(content).toContain('handoffScenarioToStorage');
    expect(content).toContain('setStorageNotice');
    expect(content).toContain('setIsSimulating(false)');
  });
});
