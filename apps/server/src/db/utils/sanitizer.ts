import { InvalidInspectionRequestError } from '../errors/postgres.errors.js';

/**
 * Strips password credentials from PostgreSQL connection strings for safe logging and error reporting.
 */
export function sanitizeConnectionString(connectionString: string): string {
  if (!connectionString || typeof connectionString !== 'string') {
    return '[EMPTY_CONNECTION_STRING]';
  }

  try {
    if (
      connectionString.startsWith('postgres://') ||
      connectionString.startsWith('postgresql://')
    ) {
      const parsed = new URL(connectionString);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    }
  } catch {
    // Fall back to regex sanitization for non-standard URI formats
  }

  // Regex replacement for URI password pattern
  let sanitized = connectionString.replace(/:\/\/(.*):(.*)@/g, '://$1:***@');

  // Key-value pair replacement (e.g. password=secret)
  sanitized = sanitized.replace(/(password\s*=\s*)([^\s;]+)/gi, '$1***');

  return sanitized;
}

/**
 * Strips embedded passwords or sensitive tokens from raw database driver error messages.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown database error';

  let sanitized = sanitizeConnectionString(message);

  // Strip "password <secret>" patterns in driver messages
  sanitized = sanitized.replace(/password\s+([^\s,;]+)/gi, 'password ***');

  // Strip "password: <secret>" or "password=<secret>" patterns
  sanitized = sanitized.replace(/password\s*[:=]\s*["']?([^"'\s,;]+)["']?/gi, 'password=***');

  return sanitized;
}

/**
 * Safely parses PostgreSQL array string literals (e.g. "{id,email}") or arrays into standard string arrays.
 */
export function parsePgArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(String);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(',')
        .map((s) => s.replace(/^"(.*)"$/, '$1').trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

/**
 * Validates a PostgreSQL identifier (schema name, table name, column name)
 * against standard SQL identifier rules to protect against injection and invalid inputs.
 */
export function validateIdentifier(identifier: string, paramName: string): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new InvalidInspectionRequestError(`${paramName} must be a non-empty string.`, paramName);
  }

  const trimmed = identifier.trim();

  // PostgreSQL max identifier length is 63 bytes (NAMEDATALEN - 1)
  if (trimmed.length > 63) {
    throw new InvalidInspectionRequestError(
      `${paramName} exceeds maximum PostgreSQL identifier length of 63 characters.`,
      paramName
    );
  }

  // Standard valid unquoted identifier regex
  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_$]*$/;
  if (!identifierRegex.test(trimmed)) {
    throw new InvalidInspectionRequestError(
      `${paramName} contains invalid characters. Must start with a letter/underscore and contain only alphanumeric characters, underscores, or $.`,
      paramName
    );
  }

  return trimmed;
}
