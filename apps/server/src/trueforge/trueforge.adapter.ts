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

export class TrueForgeAdapter implements TrueForgePort {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly defaultModelName: string;
  private readonly defaultModelProvider: string;
  private readonly timeoutMs: number;
  private readonly logger: TrueForgeLogger;
  private readonly client: TrueForge;
  private readonly fetchFn: typeof fetch;

  constructor(options: TrueForgeAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.defaultModelProvider = options.defaultModelProvider || 'google-gemini';
    this.defaultModelName =
      options.defaultModelName || `${this.defaultModelProvider}/gemini-3.6-flash`;
    this.timeoutMs = options.timeoutMs || 30000;
    this.logger = options.logger || trueforgeLogger;
    this.fetchFn = options.customFetch || fetch;

    this.client = new TrueForge({
      baseUrl: this.baseUrl,
      token: this.apiKey,
      fetch: this.fetchFn,
      timeoutInSeconds: Math.ceil(this.timeoutMs / 1000),
    });
  }

  /**
   * Verify reachability and retrieve capabilities from the TrueForge agent server.
   */
  async verifyConnectivity(): Promise<TrueForgeConnectivityResult> {
    const startTime = Date.now();
    const probeUrl = `${this.baseUrl}/api/v1/capabilities`;

    try {
      this.logger.debug('Probing TrueForge connectivity', { baseUrl: this.baseUrl });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
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

        return {
          reachable: false,
          baseUrl: this.baseUrl,
          latencyMs,
          statusMessage: `TrueForge returned HTTP ${response.status}: ${response.statusText}`,
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

      this.logger.info('TrueForge connectivity verified', {
        baseUrl: this.baseUrl,
        latencyMs,
        capabilities,
      });

      return {
        reachable: true,
        baseUrl: this.baseUrl,
        version: '0.1.4',
        statusMessage: 'TrueForge agent runtime is online and reachable.',
        capabilities,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

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
  }

  /**
   * Create an agent session on TrueForge.
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
      const sessionResponse = await this.client.sessions.create({
        agent: {
          spec: {
            model: {
              name: modelName,
              params: options?.model?.params,
            },
            instructions:
              options?.instructions ||
              'You are SchemaSentry, an AI agent for PostgreSQL schema migration safety.',
          },
        },
      });

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
            const state = event.state as { status?: string };
            if (state.status === 'failed') {
              status = 'failed';
            } else if (state.status === 'interrupted') {
              status = 'action_required';
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
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
}
