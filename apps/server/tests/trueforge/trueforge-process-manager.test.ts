import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTrueForgeReachable,
  startTrueForgeDaemonIfNeeded,
  stopManagedTrueForgeDaemon,
} from '../../src/trueforge/trueforge-process-manager.js';

describe('TrueForgeProcessManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    stopManagedTrueForgeDaemon();
    vi.restoreAllMocks();
  });

  it('detects when TrueForge is reachable on /api/v1/capabilities', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = mockFetch;

    const reachable = await isTrueForgeReachable('http://localhost:8790', 1000);
    expect(reachable).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8790/api/v1/capabilities',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns false when TrueForge is unreachable or throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    global.fetch = mockFetch;

    const reachable = await isTrueForgeReachable('http://localhost:8790', 1000);
    expect(reachable).toBe(false);
  });

  it('skips spawning when baseUrl is remote', async () => {
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'https://remote-trueforge.example.com',
    });
    expect(child).toBeNull();
  });

  it('skips spawning when TrueForge is already reachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'http://localhost:8790',
    });
    expect(child).toBeNull();
  });

  it('handles directory provisioning filesystem errors without crashing and returns null', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'http://127.0.0.1:8790',
      probeTimeoutMs: 100,
      maxWaitMs: 200,
      intervalMs: 50,
    });

    // Provisioning error should be caught, logged, and return null without crashing
    expect(child).toBeNull();
  });

  it('skips spawning when autoSpawn is false', async () => {
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'http://127.0.0.1:8790',
      autoSpawn: false,
    });
    expect(child).toBeNull();
  });

  it('skips spawning in production when autoSpawn is not explicitly true', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const child = await startTrueForgeDaemonIfNeeded({
        baseUrl: 'http://127.0.0.1:8790',
      });
      expect(child).toBeNull();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('skips spawning when baseUrl is empty string', async () => {
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: '',
    });
    expect(child).toBeNull();
  });

  it('returns false for isTrueForgeReachable when baseUrl is empty string', async () => {
    const reachable = await isTrueForgeReachable('', 1000);
    expect(reachable).toBe(false);
  });

  it('rejects invalid baseUrl formats gracefully and returns null', async () => {
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'not-a-valid-url',
    });
    expect(child).toBeNull();
  });
});
