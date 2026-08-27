import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from workspace root if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export interface TrueForgeEnvConfig {
  baseUrl: string;
  token?: string;
  apiKey?: string;
  agentName?: string;
  modelProvider: string;
  modelName: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  agentrouterApiKey?: string;
  agentrouterBaseUrl?: string;
  agentrouterModel?: string;
  autoSpawnDaemon: boolean;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  serviceName: string;
  version: string;
  databaseUrl: string;
  trueforge: TrueForgeEnvConfig;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// In production, TRUEFORGE_BASE_URL must be explicitly configured; do not default to localhost.
// In development or test, default to local TrueForge daemon port.
const defaultBaseUrl = isProduction ? '' : 'http://127.0.0.1:8790';

const autoSpawnDaemon =
  process.env.TRUEFORGE_AUTO_SPAWN_DAEMON !== undefined
    ? process.env.TRUEFORGE_AUTO_SPAWN_DAEMON === 'true'
    : !isProduction;

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  serviceName: 'orvexa-backend',
  version: '0.1.0',
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test',
  trueforge: {
    baseUrl:
      process.env.TRUEFORGE_BASE_URL !== undefined
        ? process.env.TRUEFORGE_BASE_URL
        : defaultBaseUrl,
    token: process.env.TRUEFORGE_TOKEN || process.env.TRUEFORGE_API_KEY || undefined,
    apiKey: process.env.TRUEFORGE_TOKEN || process.env.TRUEFORGE_API_KEY || undefined,
    agentName: process.env.TRUEFORGE_AGENT_NAME || undefined,
    modelProvider: process.env.TRUEFORGE_MODEL_PROVIDER || 'google-gemini',
    modelName: process.env.TRUEFORGE_MODEL_NAME || 'google-gemini/gemini-3.6-flash',
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    agentrouterApiKey: process.env.AGENTROUTER_API_KEY || undefined,
    agentrouterBaseUrl: process.env.AGENTROUTER_BASE_URL || 'https://agentrouter.org/v1',
    agentrouterModel: process.env.AGENTROUTER_MODEL || 'openai/gpt-4o-mini',
    autoSpawnDaemon,
  },
};
