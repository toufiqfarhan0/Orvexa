/**
 * Agent Interaction Contract and TrueForge Types
 * Represents the minimal application-level contract for AI agent interactions,
 * decoupled from underlying model providers or runtime SDKs.
 */

export type AgentStatus = 'completed' | 'in_progress' | 'failed' | 'action_required';

export interface AgentEvent {
  type: string;
  turnId?: string;
  sessionId?: string;
  data?: unknown;
  timestamp: string;
}

export interface AgentRequest {
  sessionId: string;
  message: string;
  context?: Record<string, unknown> | string;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  sessionId: string;
  turnId: string;
  response: string;
  status: AgentStatus;
  events?: AgentEvent[];
  model?: string;
  durationMs?: number;
}

export interface TrueForgeConfig {
  baseUrl: string;
  apiKey?: string;
  defaultModelProvider?: string;
  defaultModelName?: string;
  timeoutMs?: number;
}

export interface TrueForgeConnectivityResult {
  reachable: boolean;
  baseUrl: string;
  version?: string;
  statusMessage: string;
  capabilities?: {
    sandboxEnabled: boolean;
    skillEnabled: boolean;
    settingsEnabled: boolean;
  };
  latencyMs: number;
}

export interface TrueForgeSessionOptions {
  agentName?: string;
  instructions?: string;
  model?: {
    name: string;
    params?: Record<string, unknown>;
  };
  mcpServers?: Array<{
    name: string;
    url?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface TrueForgeSession {
  sessionId: string;
  createdAt: string;
  agentName?: string;
  model: string;
  status: 'active' | 'closed';
}

export interface TrueForgeTurnRequest {
  sessionId: string;
  message: string;
  previousTurnId?: string;
  context?: Record<string, unknown>;
}

export interface TrueForgeTurnResult {
  sessionId: string;
  turnId: string;
  status: AgentStatus;
  text: string;
  events: AgentEvent[];
  durationMs: number;
}

export interface ModelProviderConfig {
  type:
    | 'openai'
    | 'anthropic'
    | 'google-gemini'
    | 'fireworks'
    | 'zai'
    | 'moonshot'
    | 'together'
    | 'alibaba'
    | 'custom';
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models: Array<{
    modelId: string;
    name: string;
    properties?: Record<string, unknown>;
  }>;
}

export interface TrueForgePort {
  verifyConnectivity(): Promise<TrueForgeConnectivityResult>;
  createSession(options?: TrueForgeSessionOptions): Promise<TrueForgeSession>;
  getSession(sessionId: string): Promise<TrueForgeSession | null>;
  sendTurn(request: TrueForgeTurnRequest): Promise<TrueForgeTurnResult>;
  deleteSession(sessionId: string): Promise<void>;
  configureModelProvider(provider: ModelProviderConfig): Promise<void>;
  configureMcpServer(manifest: {
    name: string;
    description: string;
    type: 'remote';
    url: string;
  }): Promise<void>;
}
