import type { MigrationSession } from '@orvexa/shared';
import { MigrationSessionEntity } from '../domain/session.entity.js';
import type { MigrationSessionRepository } from './session.repository.interface.js';

/**
 * Thread-safe asynchronous In-Memory implementation of MigrationSessionRepository.
 */
export class InMemoryMigrationSessionRepository implements MigrationSessionRepository {
  private readonly _sessions = new Map<string, MigrationSession>();

  public async save(session: MigrationSessionEntity): Promise<void> {
    const snapshot = session.toSnapshot();
    this._sessions.set(snapshot.sessionId, snapshot);
  }

  public async findById(sessionId: string): Promise<MigrationSessionEntity | null> {
    const snapshot = this._sessions.get(sessionId);
    if (!snapshot) {
      return null;
    }
    return MigrationSessionEntity.fromSnapshot(snapshot);
  }

  public async findAll(): Promise<MigrationSessionEntity[]> {
    const snapshots = Array.from(this._sessions.values());
    return snapshots.map((s) => MigrationSessionEntity.fromSnapshot(s));
  }

  public async delete(sessionId: string): Promise<boolean> {
    return this._sessions.delete(sessionId);
  }

  public async clear(): Promise<void> {
    this._sessions.clear();
  }
}
