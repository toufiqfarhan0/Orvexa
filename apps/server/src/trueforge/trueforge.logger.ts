/**
 * Structured Logger for TrueForge Agent Operations
 * Provides secret-safe logging for agent sessions, turns, and network events.
 */

export interface LogContext {
  sessionId?: string;
  turnId?: string;
  eventType?: string;
  durationMs?: number;
  statusCode?: number;
  model?: string;
  error?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'api_key',
  'apikey',
  'token',
  'secret',
  'password',
  'credential',
  'key',
]);

export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redact Bearer tokens
    return data.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogData(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

export class TrueForgeLogger {
  private prefix: string;

  constructor(prefix = '[TrueForge]') {
    this.prefix = prefix;
  }

  info(message: string, context?: LogContext): void {
    const sanitized = context ? sanitizeLogData(context) : undefined;
    if (sanitized) {
      console.info(`${this.prefix} ${message}`, JSON.stringify(sanitized));
    } else {
      console.info(`${this.prefix} ${message}`);
    }
  }

  warn(message: string, context?: LogContext): void {
    const sanitized = context ? sanitizeLogData(context) : undefined;
    if (sanitized) {
      console.warn(`${this.prefix} WARN: ${message}`, JSON.stringify(sanitized));
    } else {
      console.warn(`${this.prefix} WARN: ${message}`);
    }
  }

  error(message: string, context?: LogContext): void {
    const sanitized = context ? sanitizeLogData(context) : undefined;
    if (sanitized) {
      console.error(`${this.prefix} ERROR: ${message}`, JSON.stringify(sanitized));
    } else {
      console.error(`${this.prefix} ERROR: ${message}`);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'test') {
      const sanitized = context ? sanitizeLogData(context) : undefined;
      if (sanitized) {
        console.info(`${this.prefix} DEBUG: ${message}`, JSON.stringify(sanitized));
      } else {
        console.info(`${this.prefix} DEBUG: ${message}`);
      }
    }
  }
}

export const trueforgeLogger = new TrueForgeLogger();
