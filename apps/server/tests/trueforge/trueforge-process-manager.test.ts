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

    // Mock SQLITE_PATH pointing to an illegal location or simulate mkdirSync failure
    const origPath = process.env.SQLITE_PATH;
    process.env.SQLITE_PATH = '/non_existent_root_dir_for_test/db.sqlite';

    try {
      const child = await startTrueForgeDaemonIfNeeded({
        baseUrl: 'http://127.0.0.1:8790',
        probeTimeoutMs: 100,
      });

      // Provisioning error should be caught, logged, and return null without spawning
      expect(child).toBeNull();
    } finally {
      process.env.SQLITE_PATH = origPath;
    }
  });

  it('rejects invalid baseUrl formats gracefully and returns null', async () => {
    const child = await startTrueForgeDaemonIfNeeded({
      baseUrl: 'not-a-valid-url',
    });
    expect(child).toBeNull();
  });
});
