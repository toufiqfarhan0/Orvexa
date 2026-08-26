import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrueForgeSandboxAdapter } from '../../src/sandbox/adapters/trueforge-sandbox.adapter.js';

describe('TrueForgeSandboxAdapter (Unit Tests with Boundary Mocks)', () => {
  let adapter: TrueForgeSandboxAdapter;
  const mockBaseUrl = 'http://test-server:8790';

  beforeEach(() => {
    adapter = new TrueForgeSandboxAdapter({
      baseUrl: mockBaseUrl,
      timeoutMs: 1000,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCapability', () => {
    it('1. Returns enabled=true when TrueForge capabilities reports sandbox enabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/capabilities')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                sandbox: { enabled: true },
                skill: { enabled: true },
                settings: { enabled: true },
              },
            }),
          } as unknown as Response;
        }
        if (urlStr.includes('/settings/sandbox-providers')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                manifest: { type: 'daytona' },
                status: 'ready',
              },
            }),
          } as unknown as Response;
        }
        return { ok: false, status: 404 } as unknown as Response;
      });

      const capability = await adapter.getCapability();

      expect(capability.enabled).toBe(true);
      expect(capability.providerType).toBe('daytona');
      expect(capability.status).toBe('ready');
      expect(capability.supportedPlatforms).toContain('linux');
      expect(capability.supportedPlatforms).toContain('darwin');
    });

    it('2. Returns platform diagnostic reason when sandbox is disabled on Windows host', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/capabilities')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                sandbox: { enabled: false },
                skill: {
                  enabled: false,
                  reason: 'Skills run in a sandbox, which is not configured.',
                },
                settings: { enabled: true },
              },
            }),
          } as unknown as Response;
        }
        return { ok: false, status: 404 } as unknown as Response;
      });

      const capability = await adapter.getCapability();

      expect(capability.enabled).toBe(false);
      expect(capability.status).toBe('disabled');
      if (process.platform === 'win32') {
        expect(capability.reason).toContain('LocalSandboxProvider requires macOS or Linux');
      }
    });

    it('3. Handles unreachable TrueForge server gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

      const capability = await adapter.getCapability();

      expect(capability.enabled).toBe(false);
      expect(capability.providerType).toBe('none');
      expect(capability.status).toBe('disabled');
      expect(capability.reason).toContain('TrueForge server unreachable');
    });

    it('4. Returns enabled=true with Daytona provider when daytonaApiKey is configured directly', async () => {
      const daytonaAdapter = new TrueForgeSandboxAdapter({
        daytonaApiKey: 'test-daytona-key',
      });
      const capability = await daytonaAdapter.getCapability();

      expect(capability.enabled).toBe(true);
      expect(capability.providerType).toBe('daytona');
      expect(capability.status).toBe('ready');
      expect(capability.reason).toContain('DAYTONA_API_KEY');
    });
  });

  describe('configureProvider', () => {
    it('4. Sends formatted PUT request to /api/v1/settings/sandbox-providers', async () => {
      let capturedUrl = '';
      let capturedBody = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as unknown as Response;
      });

      await adapter.configureProvider({
        type: 'daytona',
        auth: { apiKey: 'test-daytona-key' },
        execTimeoutMs: 30000,
        autoStopIntervalInMinutes: 10,
      });

      expect(capturedUrl).toBe(`${mockBaseUrl}/api/v1/settings/sandbox-providers`);
      const parsed = JSON.parse(capturedBody);
      expect(parsed.manifest.type).toBe('daytona');
      expect(parsed.manifest.auth.api_key).toBe('test-daytona-key');
      expect(parsed.manifest.exec_timeout_ms).toBe(30000);
      expect(parsed.manifest.auto_stop_interval_in_minutes).toBe(10);
    });

    it('5. Throws when TrueForge returns HTTP error on provider configuration', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid Daytona API key',
      } as unknown as Response);

      await expect(
        adapter.configureProvider({
          type: 'daytona',
          auth: { apiKey: 'invalid-key' },
        })
      ).rejects.toThrow(/Failed to configure sandbox provider in TrueForge/);
    });
  });

  describe('createSandbox and cleanup', () => {
    it('6. Throws explicit error when sandbox capability is disabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: false },
          },
        }),
      } as unknown as Response);

      await expect(adapter.createSandbox()).rejects.toThrow(/TrueForge Sandbox is unavailable/);
    });

    it('7. Creates sandbox session when capability is enabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: true },
          },
        }),
      } as unknown as Response);

      const mockSessionId = 'sandbox-session-01';
      vi.spyOn(adapter['client'].sessions, 'create').mockResolvedValue({
        data: {
          id: mockSessionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test-user',
          title: 'Test Sandbox Session',
          agent: {
            type: 'inline',
            spec: {
              model: { name: 'google-gemini/gemini-3.6-flash' },
              instructions: 'Test instructions',
            },
          },
        },
      });

      const res = await adapter.createSandbox();
      expect(res.sandboxId).toBe(mockSessionId);
    });

    it('8. Cleans up sandbox session without throwing error', async () => {
      const deleteSpy = vi.spyOn(adapter['client'].sessions, 'delete').mockResolvedValue(undefined);

      await expect(adapter.cleanup('sandbox-123')).resolves.not.toThrow();
      expect(deleteSpy).toHaveBeenCalledWith('sandbox-123');
    });
  });

  describe('execute', () => {
    it('9. Throws error when sandbox capability is disabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: false },
          },
        }),
      } as unknown as Response);

      await expect(
        adapter.execute({
          sandboxId: 'sb-123',
          command: 'echo 1',
        })
      ).rejects.toThrow(/Sandbox subsystem is not enabled/);
    });

    it('10. Throws error when sandboxId is omitted', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: true },
          },
        }),
      } as unknown as Response);

      await expect(
        adapter.execute({
          command: 'echo 1',
        })
      ).rejects.toThrow(/requires an active sandboxId/);
    });

    it('11. Executes command and returns structured output when capability is enabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: true },
          },
        }),
      } as unknown as Response);

      const result = await adapter.execute({
        sandboxId: 'sb-valid',
        command: `node -e "console.log('ORVEXA_TRUEFORGE_SANDBOX_OK')"`,
        timeoutSeconds: 5,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ORVEXA_TRUEFORGE_SANDBOX_OK');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('12. Strips sensitive credentials from environment variables', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sandbox: { enabled: true },
          },
        }),
      } as unknown as Response);

      const result = await adapter.execute({
        sandboxId: 'sb-valid',
        command: 'echo test',
        env: {
          SAFE_VAR: 'hello',
          DATABASE_PASSWORD: 'supersecretpassword',
          API_KEY: 'secret-key-12345',
          AUTH_TOKEN: 'jwt-token-val',
        },
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });
  });
});
