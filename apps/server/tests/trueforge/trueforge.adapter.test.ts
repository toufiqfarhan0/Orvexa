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

    it('returns reachable=false when baseUrl is empty', async () => {
      const adapter = new TrueForgeAdapter({
        baseUrl: '',
      });

      const result = await adapter.verifyConnectivity();

      expect(result.reachable).toBe(false);
      expect(result.statusMessage).toContain('TrueForge remote configuration missing');
    });

    it('includes Authorization Bearer header when token is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { settings: { enabled: true } } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'https://remote-trueforge.example.com',
        token: 'secret-test-token-12345',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await adapter.verifyConnectivity();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://remote-trueforge.example.com/api/v1/capabilities',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-test-token-12345',
          }),
        })
      );
    });

    it('returns authentication failure message when server returns HTTP 401', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'https://remote-trueforge.example.com',
        token: 'bad-token',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.verifyConnectivity();

      expect(result.reachable).toBe(false);
      expect(result.statusMessage).toContain('authentication failed');
    });
  });

  describe('createSession', () => {
    it('creates an agent session referencing a registered named agent', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/sessions') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 201,
            statusText: 'Created',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              data: {
                id: 'sess-registered-123',
                createdAt: '2026-08-24T12:00:00Z',
                agent: {
                  type: 'reference',
                  name: 'orvexa-executive-brief',
                },
              },
            }),
            text: async () =>
              JSON.stringify({
                data: {
                  id: 'sess-registered-123',
                  createdAt: '2026-08-24T12:00:00Z',
                  agent: {
                    type: 'reference',
                    name: 'orvexa-executive-brief',
                  },
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled mock url: ${url}`));
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'https://remote-trueforge.example.com',
        token: 'secret-token',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const session = await adapter.createSession({
        agentName: 'orvexa-executive-brief',
      });

      expect(session.sessionId).toBe('sess-registered-123');
      expect(session.agentName).toBe('orvexa-executive-brief');
      expect(session.status).toBe('active');
    });

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

  describe('configureMcpServer', () => {
    it('sends PUT to settings/mcp-servers with manifest', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ data: { name: 'schemasentry' } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        apiKey: 'test-token',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await adapter.configureMcpServer({
        name: 'schemasentry',
        description: 'SchemaSentry MCP server',
        type: 'remote',
        url: 'http://localhost:4000/api/mcp',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:8790/api/v1/settings/mcp-servers',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('configureSandboxProvider', () => {
    it('sends PUT to settings/sandbox-providers with manifest', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ data: { type: 'daytona' } }),
      });

      const adapter = new TrueForgeAdapter({
        baseUrl: 'http://test-server:8790',
        apiKey: 'test-token',
        customFetch: mockFetch as unknown as typeof fetch,
      });

      await adapter.configureSandboxProvider({
        type: 'daytona',
        auth: { apiKey: 'daytona-key' },
        autoStopIntervalInMinutes: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server:8790/api/v1/settings/sandbox-providers',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Structural Loopback URL Normalization & Dual Candidates', () => {
    it('trims trailing slashes while preserving configured hostname', () => {
      const adapter1 = new TrueForgeAdapter({
        baseUrl: 'http://localhost:8790/',
      });
      expect((adapter1 as unknown as { baseUrl: string }).baseUrl).toBe('http://localhost:8790');

      const adapter2 = new TrueForgeAdapter({
        baseUrl: 'http://127.0.0.1:8790///',
      });
      expect((adapter2 as unknown as { baseUrl: string }).baseUrl).toBe('http://127.0.0.1:8790');
    });

    it('does not corrupt subdomains, paths, or remote domains containing the localhost substring', () => {
      const adapter1 = new TrueForgeAdapter({
        baseUrl: 'https://localhost.example.com',
      });
      expect((adapter1 as unknown as { baseUrl: string }).baseUrl).toBe(
        'https://localhost.example.com'
      );

      const adapter2 = new TrueForgeAdapter({
        baseUrl: 'https://example.com/localhost/path',
      });
      expect((adapter2 as unknown as { baseUrl: string }).baseUrl).toBe(
        'https://example.com/localhost/path'
      );

      const adapter3 = new TrueForgeAdapter({
        baseUrl: 'http://127.0.0.1:8790',
      });
      expect((adapter3 as unknown as { baseUrl: string }).baseUrl).toBe('http://127.0.0.1:8790');
    });
  });
});
