import { DomainError } from '../../domain/errors.js';

/**
 * Thrown when connection establishment to the target PostgreSQL database fails.
 */
export class PostgresConnectionError extends DomainError {
  public readonly code = 'POSTGRES_CONNECTION_ERROR';

  constructor(
    message: string,
    public readonly sanitizedTarget?: string,
    public readonly originalErrorCode?: string
  ) {
    super(message);
  }
}

/**
 * Thrown when an inspection catalog query fails.
 */
export class PostgresQueryError extends DomainError {
  public readonly code = 'POSTGRES_QUERY_ERROR';

  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalErrorCode?: string
  ) {
    super(message);
  }
}

/**
 * Thrown when input parameters for an inspection query fail validation (e.g. invalid identifier format).
 */
export class InvalidInspectionRequestError extends DomainError {
  public readonly code = 'INVALID_INSPECTION_REQUEST';

  constructor(
    message: string,
    public readonly fieldName?: string
  ) {
    super(message);
  }
}

/**
 * Thrown when an unsupported PostgreSQL capability or insufficient permission is encountered.
 */
export class PostgresCapabilityError extends DomainError {
  public readonly code = 'POSTGRES_CAPABILITY_ERROR';

  constructor(
    message: string,
    public readonly requiredPermission?: string
  ) {
    super(message);
  }
}
