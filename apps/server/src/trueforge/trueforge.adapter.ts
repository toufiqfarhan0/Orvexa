import { TrueForge } from '@truefoundry/trueforge-sdk';
import type {
  AgentEvent,
  AgentStatus,
  ModelProviderConfig,
  TrueForgeConfig,
  TrueForgeConnectivityResult,
  TrueForgePort,
  TrueForgeSession,
  TrueForgeSessionOptions,
  TrueForgeTurnRequest,
  TrueForgeTurnResult,
} from '@orvexa/shared';
import { TrueForgeLogger, trueforgeLogger } from './trueforge.logger.js';

export interface TrueForgeAdapterOptions extends TrueForgeConfig {
  logger?: TrueForgeLogger;
  customFetch?: typeof fetch;
}

/**
 * Structurally normalizes loopback URLs (converting exact hostname 'localhost' to '127.0.0.1')
 * without corrupting remote domains, subdomains, paths, queries, fragments, or auth credentials.
 */
export function normalizeLoopbackUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

/**
 * Returns candidate loopback URLs for dual IPv4/IPv6 probe fallback
 * while strictly preserving all non-hostname URL components.
 */
export function getLoopbackCandidateUrls(baseUrl: string): string[] {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'localhost') {
      const alt = new URL(trimmed);
      alt.hostname = '127.0.0.1';
      return [trimmed, alt.toString().replace(/\/+$/, '')];
    } else if (parsed.hostname === '127.0.0.1') {
      const alt = new URL(trimmed);
      alt.hostname = 'localhost';
      return [trimmed, alt.toString().replace(/\/+$/, '')];
    }
    return [trimmed];
  } catch {
    return [trimmed];
  }
}

export class TrueForgeAdapter implements TrueForgePort {
  private baseUrl: string;
  private readonly token?: string;
  private readonly defaultModelName: string;
  private readonly defaultModelProvider: string;
  private readonly timeoutMs: number;
  private readonly logger: TrueForgeLogger;
  private client: TrueForge;
  private readonly fetchFn: typeof fetch;

  constructor(options: TrueForgeAdapterOptions) {
    this.baseUrl = normalizeLoopbackUrl(options.baseUrl || '');
    this.token = options.token || options.apiKey;
    this.defaultModelProvider = options.defaultModelProvider || 'google-gemini';
    this.defaultModelName =
      options.defaultModelName || `${this.defaultModelProvider}/gemini-3.6-flash`;
    this.timeoutMs = options.timeoutMs || 30000;
    this.logger = options.logger || trueforgeLogger;
    this.fetchFn = options.customFetch || fetch;

    this.client = new TrueForge({
      baseUrl: this.baseUrl,
      token: this.token,
      fetch: this.fetchFn,
      timeoutInSeconds: Math.ceil(this.timeoutMs / 1000),
    });
  }

  /**
   * Verify reachability and retrieve capabilities from the TrueForge agent server.
   */
  async verifyConnectivity(): Promise<TrueForgeConnectivityResult> {
    const startTime = Date.now();

    if (!this.baseUrl || this.baseUrl.trim() === '') {
      return {
        reachable: false,
        baseUrl: '',
        latencyMs: 0,
        statusMessage:
          'TrueForge remote configuration missing (TRUEFORGE_BASE_URL is not configured).',
      };
    }

    const candidateUrls = getLoopbackCandidateUrls(this.baseUrl);
    let lastError: unknown = null;

    for (const url of candidateUrls) {
      const probeUrl = `${url}/api/v1/capabilities`;
      try {
        this.logger.debug('Probing TrueForge connectivity', { baseUrl: url });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await this.fetchFn(probeUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          this.logger.warn('TrueForge connectivity check returned non-200', {
            statusCode: response.status,
            latencyMs,
          });

          const isAuthError = response.status === 401 || response.status === 403;
          const statusMessage = isAuthError
            ? `TrueForge authentication failed: HTTP ${response.status} (Check TRUEFORGE_TOKEN)`
            : `TrueForge returned HTTP ${response.status}: ${response.statusText}`;

          return {
            reachable: false,
            baseUrl: url,
            latencyMs,
            statusMessage,
          };
        }

        const data = (await response.json()) as {
          data?: {
            sandbox?: { enabled: boolean };
            skill?: { enabled: boolean };
            settings?: { enabled: boolean };
          };
        };

        const capabilities = data.data
          ? {
              sandboxEnabled: data.data.sandbox?.enabled ?? false,
              skillEnabled: data.data.skill?.enabled ?? false,
              settingsEnabled: data.data.settings?.enabled ?? true,
            }
          : undefined;

        if (this.baseUrl !== url) {
          this.baseUrl = url;
          this.client = new TrueForge({
            baseUrl: this.baseUrl,
            token: this.token,
            fetch: this.fetchFn,
            timeoutInSeconds: Math.ceil(this.timeoutMs / 1000),
          });
        }

        this.logger.info('TrueForge connectivity verified', {
          baseUrl: url,
          latencyMs,
          capabilities,
        });

        return {
          reachable: true,
          baseUrl: url,
          version: '0.1.4',
          statusMessage: 'TrueForge agent runtime is online and reachable.',
          capabilities,
          latencyMs,
        };
      } catch (err: unknown) {
        lastError = err;
      }
    }

    const latencyMs = Date.now() - startTime;
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

    this.logger.error('TrueForge connectivity probe failed', {
      error: errorMessage,
      latencyMs,
    });

    return {
      reachable: false,
      baseUrl: this.baseUrl,
      latencyMs,
      statusMessage: `Failed to reach TrueForge server: ${errorMessage}`,
    };
  }

  /**
   * Create an agent session on TrueForge using either a registered agent name or inline spec.
   */
  async createSession(options?: TrueForgeSessionOptions): Promise<TrueForgeSession> {
    const startTime = Date.now();
    let modelName = options?.model?.name || this.defaultModelName;
    if (modelName.includes('gemini-3.6-flash')) {
      modelName = modelName.replace('gemini-3.6-flash', 'gemini-3-6-flash');
    } else if (modelName.includes('gemini-3.1-pro-preview')) {
      modelName = modelName.replace('gemini-3.1-pro-preview', 'gemini-3-1-pro-preview');
    } else if (modelName.includes('gpt-5.4-mini')) {
      modelName = modelName.replace('gpt-5.4-mini', 'gpt-5-4-mini');
    }

    this.logger.info('Creating TrueForge session', {
      model: modelName,
      agentName: options?.agentName,
    });

    try {
      let sessionResponse;

      // If inline specification (instructions, model, mcpServers, sandbox) is provided,
      // create session with dynamic inline agent specification.
      const hasInlineSpec = Boolean(
        options?.instructions ||
          options?.mcpServers ||
          options?.sandbox ||
          !options?.agentName
      );

      if (!hasInlineSpec && options?.agentName) {
        // Sanitize agent name to meet TrueForge regex: [a-z][a-z0-9._-]*[a-z0-9]
        const cleanName = options.agentName
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '-')
          .replace(/^[^a-z]+/, '')
          .slice(0, 64) || 'orvexa-agent';

        sessionResponse = await this.client.sessions.create({
          agent: {
            name: cleanName,
          },
        });
      } else {
        // Create session with dynamic inline agent specification
        const mcpServers = options?.mcpServers
          ? options.mcpServers.map((s) => ({
              name: s.name,
              preload: true,
              enableTools: ['@all'],
            }))
          : undefined;

        const sandbox = options?.sandbox
          ? {
              provider: options.sandbox.provider || 'daytona',
            }
          : undefined;

        const spec: Record<string, unknown> = {
          model: {
            name: modelName,
            params: options?.model?.params,
          },
          instructions:
            options?.instructions ||
            'You are Orvexa, an AI agent for PostgreSQL schema migration safety.',
        };

        if (mcpServers && mcpServers.length > 0) {
          spec.mcpServers = mcpServers;
        }
        if (sandbox) {
          spec.sandbox = sandbox;
        }

        sessionResponse = await this.client.sessions.create({
          agent: {
            spec: spec as unknown as {
              model: { name: string; params?: Record<string, unknown> };
              instructions: string;
              mcpServers?: Array<{ name: string; preload?: boolean; enableTools?: string[] }>;
            },
          },
        });
      }

      const session = sessionResponse.data;
      const durationMs = Date.now() - startTime;

      this.logger.info('TrueForge session created successfully', {
        sessionId: session.id,
        durationMs,
      });

      return {
        sessionId: session.id,
        createdAt: session.createdAt,
        agentName: options?.agentName,
        model: modelName,
        status: 'active',
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error('Failed to create TrueForge session', {
        error: errorMessage,
        durationMs,
      });

      if (
        (err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 404) ||
        errorMessage.includes('not found') ||
        errorMessage.includes('NotFoundError')
      ) {
        throw new Error(
          `TrueForge agent not found: '${options?.agentName || modelName}'. Verify that the agent exists in the TrueForge registry.`
        );
      }

      if (
        (err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          ((err as { statusCode: number }).statusCode === 401 ||
            (err as { statusCode: number }).statusCode === 403)) ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Forbidden')
      ) {
        throw new Error('TrueForge authentication failed. Please verify TRUEFORGE_TOKEN.');
      }

      throw new Error(`TrueForge session creation failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch an existing session by ID.
   */
  async getSession(sessionId: string): Promise<TrueForgeSession | null> {
    try {
      const res = await this.client.sessions.get(sessionId);
      const session = res.data;

      const model =
        (session.agent.type === 'inline' ? session.agent.spec.model.name : session.agent.name) ||
        this.defaultModelName;

      return {
        sessionId: session.id,
        createdAt: session.createdAt,
        agentName:
          session.agent.type === 'reference' ? (session.agent.name ?? undefined) : undefined,
        model,
        status: 'active',
      };
    } catch (err: unknown) {
      // Return null if not found
      if (
        err &&
        typeof err === 'object' &&
        'statusCode' in err &&
        (err as { statusCode: number }).statusCode === 404
      ) {
        return null;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn('Failed to get TrueForge session', { sessionId, error: errorMessage });
      return null;
    }
  }

  /**
   * Send a user turn to a session and aggregate the agent response and events.
   */
  async sendTurn(request: TrueForgeTurnRequest): Promise<TrueForgeTurnResult> {
    const startTime = Date.now();
    const { sessionId, message, previousTurnId } = request;

    this.logger.info('Sending turn to TrueForge session', {
      sessionId,
      previousTurnId,
    });

    let turnId = 'pending';
    let status: AgentStatus = 'completed';
    let accumulatedText = '';
    const events: AgentEvent[] = [];

    try {
      const stream = await this.client.sessions.createTurnStream(sessionId, {
        input: [
          {
            type: 'user.message',
            content: message,
          },
        ],
        previousTurnId,
      });

      for await (const event of stream) {
        const timestamp = new Date().toISOString();
        const eventType = event.type;

        // Record turnId from turn events if present
        if (
          'id' in event &&
          typeof event.id === 'string' &&
          (eventType === 'turn.created' || eventType === 'turn.done')
        ) {
          turnId = event.id;
        } else if ('turnId' in event && typeof event.turnId === 'string') {
          turnId = event.turnId;
        } else if (
          'turn_id' in event &&
          typeof (event as { turn_id?: string }).turn_id === 'string'
        ) {
          turnId = (event as { turn_id: string }).turn_id;
        }

        events.push({
          type: eventType,
          turnId,
          sessionId,
          data: event,
          timestamp,
        });

        if (eventType === 'model.message.delta' && 'content' in event) {
          accumulatedText += event.content || '';
        } else if (eventType === 'model.message' && 'content' in event) {
          if (typeof event.content === 'string') {
            accumulatedText = event.content;
          }
        } else if (eventType === 'turn.done') {
          if ('state' in event && event.state) {
            const state = event.state as {
              status?: string;
              output?: { content?: string; type?: string };
            };
            if (state.status === 'failed' || state.status === 'error') {
              status = 'failed';
            } else if (state.status === 'interrupted' || state.status === 'action_required') {
              status = 'action_required';
            } else if (state.status === 'done' || state.status === 'completed') {
              status = 'completed';
            }
            if (
              state.output?.content &&
              (!accumulatedText || accumulatedText.trim().length === 0)
            ) {
              accumulatedText = state.output.content;
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.info('TrueForge turn finished', {
        sessionId,
        turnId,
        status,
        durationMs,
        eventsCount: events.length,
      });

      return {
        sessionId,
        turnId,
        status,
        text: accumulatedText.trim(),
        events,
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error('TrueForge turn execution failed', {
        sessionId,
        turnId,
        error: errorMessage,
        durationMs,
      });

      throw new Error(`TrueForge turn execution failed: ${errorMessage}`);
    }
  }

  /**
   * Delete a session and clean up resources.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const startTime = Date.now();
    try {
      await this.client.sessions.delete(sessionId);
      this.logger.info('TrueForge session deleted', {
        sessionId,
        durationMs: Date.now() - startTime,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn('Failed to delete TrueForge session', { sessionId, error: errorMessage });
    }
  }

  /**
   * Configure or update a model provider in TrueForge settings.
   */
  async configureModelProvider(provider: ModelProviderConfig): Promise<void> {
    const url = `${this.baseUrl}/api/v1/settings/model-providers`;

    const models = provider.models.map((m) => ({
      model_id: m.modelId,
      name: m.name,
      properties: m.properties || {},
    }));

    const manifest: Record<string, unknown> = {
      type: provider.type,
      models,
    };

    if (provider.apiKey) {
      manifest.auth = {
        api_key: provider.apiKey,
      };
    }

    if (provider.baseUrl) {
      manifest.base_url = provider.baseUrl;
    }

    if (provider.type === 'custom' && provider.name) {
      manifest.name = provider.name;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ manifest }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to configure model provider ${provider.type}: HTTP ${response.status} ${errorText}`
      );
    }

    this.logger.info('Configured model provider in TrueForge', {
      type: provider.type,
      modelsCount: models.length,
    });
  }

  /**
   * Registers or updates an MCP server configuration in TrueForge settings.
   *
   * @param manifest - MCP server registration manifest (name, url, type, description).
   */
  async configureMcpServer(manifest: {
    name: string;
    description: string;
    type: 'remote';
    url: string;
  }): Promise<void> {
    const url = `${this.baseUrl}/api/v1/settings/mcp-servers`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const payload = {
      manifest: {
        name: manifest.name,
        description: manifest.description,
        type: 'remote' as const,
        url: manifest.url,
      },
    };

    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to configure MCP server ${manifest.name}: HTTP ${response.status} ${errorText}`
      );
    }

    this.logger.info('Configured MCP server in TrueForge', {
      name: manifest.name,
      url: manifest.url,
    });
  }

  /**
   * Lists available tools exposed by a registered MCP server in TrueForge.
   */
  async listMcpServerTools(serverName: string): Promise<string[]> {
    const response = await this.client.mcpServers.listTools(serverName);
    return (response.data || []).map(
      (t: Record<string, unknown>) => (t.name as string) || String(t)
    );
  }

  /**
   * Registers or updates the sandbox provider configuration in TrueForge settings.
   */
  async configureSandboxProvider(manifest: {
    type: 'daytona' | 'e2b' | 'docker' | 'custom' | string;
    auth?: {
      apiKey?: string;
    };
    autoStopIntervalInMinutes?: number;
    autoDeleteIntervalInMinutes?: number;
    execTimeoutMs?: number;
    config?: Record<string, unknown>;
  }): Promise<void> {
    const url = `${this.baseUrl}/api/v1/settings/sandbox-providers`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const manifestPayload: Record<string, unknown> = {
      type: manifest.type,
      auto_stop_interval_in_minutes: manifest.autoStopIntervalInMinutes ?? 10,
      auto_archive_interval_in_minutes: 60,
      auto_delete_interval_in_minutes: manifest.autoDeleteIntervalInMinutes ?? 1440,
      exec_timeout_ms: manifest.execTimeoutMs ?? 30000,
    };

    if (manifest.auth?.apiKey) {
      manifestPayload.auth = {
        api_key: manifest.auth.apiKey,
      };
    }

    if (manifest.config) {
      manifestPayload.config = manifest.config;
    }

    const payload = {
      manifest: manifestPayload,
    };

    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to configure sandbox provider ${manifest.type}: HTTP ${response.status} ${errorText}`
      );
    }

    this.logger.info('Configured sandbox provider in TrueForge', {
      type: manifest.type,
    });
  }
}
