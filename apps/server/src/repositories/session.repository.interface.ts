import type { MigrationSessionEntity } from '../domain/session.entity.js';

/**
 * Repository interface defining persistence operations for MigrationSession aggregate roots.
 */
export interface MigrationSessionRepository {
  save(session: MigrationSessionEntity): Promise<void>;
  findById(sessionId: string): Promise<MigrationSessionEntity | null>;
  findAll(): Promise<MigrationSessionEntity[]>;
  delete(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
}
