import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from workspace root if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  serviceName: string;
  version: string;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  serviceName: 'orvexa-backend',
  version: '0.1.0',
};
