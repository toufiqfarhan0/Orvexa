import type {
  CreateMigrationSessionDto,
  ApprovalDecision,
  ProposedMigration,
  TargetDatabaseMetadata,
} from '@orvexa/shared';
import { ValidationError } from './errors.js';

/**
 * Validates target database metadata input.
 */
export function validateTargetDatabase(db: TargetDatabaseMetadata): void {
  const errors: string[] = [];

  if (!db) {
    throw new ValidationError('Target database metadata is required.');
  }

  if (db.engine !== 'postgresql') {
    errors.push(
      `Unsupported database engine '${db.engine}'. Only 'postgresql' is currently supported.`
    );
  }

  if (
    !db.databaseName ||
    typeof db.databaseName !== 'string' ||
    db.databaseName.trim().length === 0
  ) {
    errors.push('Target database name must be a non-empty string.');
  }

  if (!db.schemaName || typeof db.schemaName !== 'string' || db.schemaName.trim().length === 0) {
    errors.push('Target schema name must be a non-empty string.');
  }

  if (
    db.estimatedRowCount !== undefined &&
    (typeof db.estimatedRowCount !== 'number' || db.estimatedRowCount < 0)
  ) {
    errors.push('Estimated row count must be a non-negative number.');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid target database metadata.', errors);
  }
}

/**
 * Validates proposed migration payload input.
 */
export function validateProposedMigration(migration: ProposedMigration): void {
  const errors: string[] = [];

  if (!migration) {
    throw new ValidationError('Proposed migration details are required.');
  }

  if (!migration.name || typeof migration.name !== 'string' || migration.name.trim().length === 0) {
    errors.push('Migration name must be a non-empty string.');
  }

  if (
    !migration.rawSql ||
    typeof migration.rawSql !== 'string' ||
    migration.rawSql.trim().length === 0
  ) {
    errors.push('Migration raw SQL must be a non-empty string.');
  }

  if (!migration.primaryOperation || typeof migration.primaryOperation !== 'string') {
    errors.push('Primary migration operation type is required.');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid proposed migration payload.', errors);
  }
}

/**
 * Validates the full session creation DTO.
 */
export function validateCreateSessionDto(dto: CreateMigrationSessionDto): void {
  if (!dto) {
    throw new ValidationError('Create migration session payload is required.');
  }

  validateTargetDatabase(dto.targetDatabase);
  validateProposedMigration(dto.proposedMigration);
}

/**
 * Validates recorded approval decision.
 */
export function validateApprovalDecision(decision: ApprovalDecision): void {
  const errors: string[] = [];

  if (!decision) {
    throw new ValidationError('Approval decision payload is required.');
  }

  if (
    !decision.approver ||
    typeof decision.approver !== 'string' ||
    decision.approver.trim().length === 0
  ) {
    errors.push('Approver identifier (name/email/id) is required.');
  }

  if (decision.status !== 'APPROVED' && decision.status !== 'REJECTED') {
    errors.push(
      `Invalid approval decision status '${decision.status}'. Must be 'APPROVED' or 'REJECTED'.`
    );
  }

  if (
    decision.status === 'REJECTED' &&
    (!decision.rejectionReason || decision.rejectionReason.trim().length === 0)
  ) {
    errors.push('A rejection reason must be provided when rejecting a migration approval request.');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid approval decision payload.', errors);
  }
}
