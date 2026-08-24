import { describe, expect, it, vi } from 'vitest';
import { TrueForgeAdapter } from '../../src/trueforge/trueforge.adapter.js';
import { TrueForgeLogger, sanitizeLogData } from '../../src/trueforge/trueforge.logger.js';

describe('TrueForgeLogger (Observability & Security)', () => {
  it('sanitizes sensitive fields from log data', () => {
    const data = {
      sessionId: 'sess-123',
      apiKey: 'secret-api-key-12345',
      authorization: 'Bearer token-abcdef',
      nested: {
        password: 'db-password',
        token: 'jwt-token-val',
        regularField: 'safe-value',
      },
    };

    const sanitized = sanitizeLogData(data) as Record<string, unknown>;
    expect(sanitized.sessionId).toBe('sess-123');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).token).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).regularField).toBe('safe-value');
  });

  it('redacts Bearer tokens in plain strings', () => {
    const raw = 'Header was Authorization: Bearer abc.123.xyz in request';
    const sanitized = sanitizeLogData(raw);
    expect(sanitized).toBe('Header was Authorization: Bearer [REDACTED] in request');
  });

  it('logs info, warn, error without throwing', () => {
    const logger = new TrueForgeLogger('[TestLogger]');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('Info message', { sessionId: 's-1' });
    logger.warn('Warn message', { sessionId: 's-1' });
    logger.error('Error message', { error: 'something broke' });

    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('TrueForgeAdapter (Unit Tests with Boundary Mocks)', () => {
  describe('verifyConnectivity', () => {
    it('returns reachable=true and parses capabilities on 200 OK', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: {
            sandbox: { enabled: true },
            skill: { enabled: false },
            settings: { enabled: true },
          },
        }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.verifyConnectivity();

      expect(result.reachable).toBe(true);
      expect(result.baseUrl).toBe('http://test-server:8790');
      expect(result.capabilities).toEqual({
        sandboxEnabled: true,
        skillEnabled: false,
        settingsEnabled: true,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:8790/api/v1/capabilities',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns reachable=false when server returns HTTP 500', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.verifyConnectivity();

      expect(result.reachable).toBe(false);
      expect(result.statusMessage).toContain('HTTP 500');
    });

    it('returns reachable=false on network connection failure / timeout', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.verifyConnectivity();

      expect(result.reachable).toBe(false);
      expect(result.statusMessage).toContain('ECONNREFUSED');
    });
  });

  describe('createSession', () => {
    it('creates an agent session and returns structured TrueForgeSession', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/sessions') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 201,
            statusText: 'Created',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              data: {
                id: 'sess-abc-123',
                createdAt: '2026-08-24T12:00:00Z',
                agent: {
                  type: 'inline',
                  spec: {
                    model: { name: 'google-gemini/gemini-3.6-flash' },
                  },
                },
              },
            }),
            text: async () =>
              JSON.stringify({
                data: {
                  id: 'sess-abc-123',
                  createdAt: '2026-08-24T12:00:00Z',
                  agent: {
                    type: 'inline',
                    spec: {
                      model: { name: 'google-gemini/gemini-3.6-flash' },
                    },
                  },
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled mock url: ${url}`));
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const session = await adapter.createSession({
        instructions: 'Test instructions',
        model: { name: 'google-gemini/gemini-3.6-flash' },
      });

      expect(session.sessionId).toBe('sess-abc-123');
      expect(session.model).toBe('google-gemini/gemini-3-6-flash');
      expect(session.status).toBe('active');
    });

    it('throws when session creation fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { message: 'Unknown model' },
        }),
        text: async () => JSON.stringify({ error: { message: 'Unknown model' } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await expect(
        adapter.createSession({
          model: { name: 'invalid-model' },
        })
      ).rejects.toThrow(/TrueForge session creation failed/);
    });
  });

  describe('getSession', () => {
    it('fetches an existing session by ID', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/sessions/sess-123')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              data: {
                id: 'sess-123',
                createdAt: '2026-08-24T12:00:00Z',
                agent: {
                  type: 'inline',
                  spec: {
                    model: { name: 'openai/gpt-5.4-mini' },
                  },
                },
              },
            }),
            text: async () =>
              JSON.stringify({
                data: {
                  id: 'sess-123',
                  createdAt: '2026-08-24T12:00:00Z',
                  agent: {
                    type: 'inline',
                    spec: {
                      model: { name: 'openai/gpt-5.4-mini' },
                    },
                  },
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled mock url: ${url}`));
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const session = await adapter.getSession('sess-123');
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe('sess-123');
      expect(session?.model).toBe('openai/gpt-5.4-mini');
    });

    it('returns null on 404 Not Found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { message: 'Session not found' },
        }),
        text: async () => JSON.stringify({ error: { message: 'Session not found' } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const session = await adapter.getSession('sess-nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('sendTurn', () => {
    it('executes turn stream and aggregates delta chunks into response text', async () => {
      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
      });

      async function* mockStream() {
        yield {
          type: 'turn.created',
          id: 'turn-999',
          created_at: '2026-08-24T12:00:00Z',
        };
        yield {
          type: 'model.message.delta',
          id: 'delta-1',
          content: 'TRUEFORGE',
        };
        yield {
          type: 'model.message.delta',
          id: 'delta-2',
          content: '_ORVEXA_OK',
        };
        yield {
          type: 'turn.done',
          id: 'turn-999',
          state: { status: 'completed' },
        };
      }

      // @ts-expect-error - overriding internal client for mock
      adapter.client.sessions.createTurnStream = vi.fn().mockResolvedValue(mockStream());

      const result = await adapter.sendTurn({
        sessionId: 'sess-123',
        message: 'Reply with exactly: TRUEFORGE_ORVEXA_OK',
      });

      expect(result.sessionId).toBe('sess-123');
      expect(result.turnId).toBe('turn-999');
      expect(result.status).toBe('completed');
      expect(result.text).toBe('TRUEFORGE_ORVEXA_OK');
      expect(result.events.length).toBe(4);
    });

    it('handles failed turn status and records failure', async () => {
      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
      });

      async function* mockStream() {
        yield {
          type: 'turn.created',
          id: 'turn-error',
        };
        yield {
          type: 'turn.done',
          id: 'turn-error',
          state: { status: 'failed' },
        };
      }

      // @ts-expect-error - overriding internal client for mock
      adapter.client.sessions.createTurnStream = vi.fn().mockResolvedValue(mockStream());

      const result = await adapter.sendTurn({
        sessionId: 'sess-123',
        message: 'Test message',
      });

      expect(result.turnId).toBe('turn-error');
      expect(result.status).toBe('failed');
    });

    it('throws error when turn creation fails at network layer', async () => {
      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
      });

      // @ts-expect-error - overriding internal client for mock
      adapter.client.sessions.createTurnStream = vi
        .fn()
        .mockRejectedValue(new Error('Network timeout'));

      await expect(
        adapter.sendTurn({
          sessionId: 'sess-123',
          message: 'Hello',
        })
      ).rejects.toThrow(/TrueForge turn execution failed: Network timeout/);
    });
  });

  describe('deleteSession', () => {
    it('deletes session without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '',
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await expect(adapter.deleteSession('sess-123')).resolves.not.toThrow();
    });
  });

  describe('configureModelProvider', () => {
    it('sends PUT to settings/model-providers with manifest and authorization', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { name: 'google-gemini' } }),
        text: async () => JSON.stringify({ data: { name: 'google-gemini' } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        apiKey: 'test-id-token',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await adapter.configureModelProvider({
        type: 'google-gemini',
        apiKey: 'test-gemini-key',
        models: [{ modelId: 'gemini-3.6-flash', name: 'gemini-3-6-flash' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:8790/api/v1/settings/model-providers',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-id-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws error when provider configuration fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid manifest format',
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await expect(
        adapter.configureModelProvider({
          type: 'google-gemini',
          models: [],
        })
      ).rejects.toThrow(/Failed to configure model provider/);
    });
  });
});
