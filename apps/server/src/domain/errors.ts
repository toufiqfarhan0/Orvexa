import type { MigrationSessionStatus } from '@orvexa/shared';

/**
 * Base domain exception class.
 */
export abstract class DomainError extends Error {
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an illegal state transition is attempted on a session.
 */
export class InvalidStateTransitionError extends DomainError {
  public readonly code = 'INVALID_STATE_TRANSITION';

  constructor(
    public readonly fromStatus: MigrationSessionStatus,
    public readonly toStatus: MigrationSessionStatus,
    public readonly sessionId?: string,
    public readonly reason?: string
  ) {
    const details = reason ? ` (${reason})` : '';
    const sessionPrefix = sessionId ? `Session [${sessionId}] ` : '';
    super(`${sessionPrefix}Cannot transition from '${fromStatus}' to '${toStatus}'${details}.`);
  }
}

/**
 * Thrown when a session is not found in the repository.
 */
export class SessionNotFoundError extends DomainError {
  public readonly code = 'SESSION_NOT_FOUND';

  constructor(public readonly sessionId: string) {
    super(`Migration session with ID '${sessionId}' was not found.`);
  }
}

/**
 * Thrown when domain input validation fails.
 */
export class ValidationError extends DomainError {
  public readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly validationErrors?: string[]
  ) {
    super(message);
  }
}

/**
 * Thrown when an action is attempted that violates domain business rules or preconditions.
 */
export class IllegalActionError extends DomainError {
  public readonly code = 'ILLEGAL_ACTION';

  constructor(
    message: string,
    public readonly violatedPrecondition: string
  ) {
    super(message);
  }
}

/**
 * Thrown when dependency injection or component configuration is invalid or conflicting.
 */
export class ConfigurationError extends DomainError {
  public readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a concurrent operation or conflict occurs on a resource.
 */
export class ConflictError extends DomainError {
  public readonly code = 'CONFLICT_ERROR';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when an external integration service (e.g. TrueForge, Gemini, Daytona) fails or returns an invalid outcome.
 */
export class ExternalServiceError extends DomainError {
  public readonly code = 'EXTERNAL_SERVICE_ERROR';

  constructor(
    message: string,
    public readonly service?: string
  ) {
    super(message);
  }
}
