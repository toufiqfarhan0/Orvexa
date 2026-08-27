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
  apiKey?: string;
  modelProvider: string;
  modelName: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
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

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  serviceName: 'orvexa-backend',
  version: '0.1.0',
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test',
  trueforge: {
    baseUrl: process.env.TRUEFORGE_BASE_URL || 'http://127.0.0.1:8790',
    apiKey: process.env.TRUEFORGE_API_KEY || undefined,
    modelProvider: process.env.TRUEFORGE_MODEL_PROVIDER || 'google-gemini',
    modelName: process.env.TRUEFORGE_MODEL_NAME || 'google-gemini/gemini-3.6-flash',
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  },
};
