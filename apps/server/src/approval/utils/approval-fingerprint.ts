import { createHash } from 'node:crypto';
import type { MigrationApprovalFingerprint, MigrationSession } from '@orvexa/shared';
import type { MigrationSessionEntity } from '../../domain/session.entity.js';

/**
 * Deterministic cryptographic fingerprint generator and validator.
 * Binds an approval decision to an exact proposed migration, target database, and rehearsal result.
 */
export class ApprovalFingerprintGenerator {
  /**
   * Computes the deterministic SHA-256 approval fingerprint for a session.
   */
  public static compute(
    session: MigrationSessionEntity | MigrationSession
  ): MigrationApprovalFingerprint {
    const data = 'toSnapshot' in session ? session.toSnapshot() : session;

    const migrationId = data.request.proposedMigration.migrationId;
    const rawSql = data.request.proposedMigration.rawSql.trim();
    const databaseName = data.request.targetDatabase.databaseName.trim();
    const schemaName = data.request.targetDatabase.schemaName.trim();
    const engine = data.request.targetDatabase.engine.trim();
    const rehearsalId = data.sandboxResult?.rehearsalId || '';
    const rehearsalStatus = data.sandboxResult?.status || '';

    // 1. SQL hash
    const sqlHash = createHash('sha256').update(rawSql, 'utf8').digest('hex');

    // 2. Target database hash
    const targetDatabasePayload = JSON.stringify({
      engine,
      databaseName,
      schemaName,
    });
    const targetDatabaseHash = createHash('sha256')
      .update(targetDatabasePayload, 'utf8')
      .digest('hex');

    // 3. Composite canonical payload (Zero secrets, zero credentials)
    const compositePayload = JSON.stringify({
      migrationId,
      sqlHash,
      targetDatabaseHash,
      rehearsalId,
      rehearsalStatus,
    });

    const fingerprintHash = createHash('sha256').update(compositePayload, 'utf8').digest('hex');

    return {
      migrationId,
      sqlHash,
      targetDatabaseHash,
      rehearsalId,
      rehearsalStatus,
      fingerprintHash,
    };
  }

  /**
   * Verifies if a given fingerprint hash matches the current session state.
   */
  public static verify(
    session: MigrationSessionEntity | MigrationSession,
    expectedFingerprint: string
  ): boolean {
    if (!expectedFingerprint || typeof expectedFingerprint !== 'string') {
      return false;
    }
    const current = this.compute(session);
    return current.fingerprintHash === expectedFingerprint.trim();
  }
}
