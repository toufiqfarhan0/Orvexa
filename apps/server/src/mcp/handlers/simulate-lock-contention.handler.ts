/**
 * Simulate Lock Contention MCP Handler
 *
 * Analyzes PostgreSQL 8-level lock hierarchy conflicts and concurrent query impact.
 */

export interface SimulateLockContentionArgs {
  table: string;
  schema?: string;
  proposedLockMode?:
    | 'ACCESS_EXCLUSIVE'
    | 'EXCLUSIVE'
    | 'SHARE_ROW_EXCLUSIVE'
    | 'SHARE'
    | 'SHARE_UPDATE_EXCLUSIVE'
    | 'ROW_EXCLUSIVE'
    | 'ROW_SHARE'
    | 'ACCESS_SHARE'
    | string;
}

export interface LockContentionOutput {
  target: {
    schema: string;
    table: string;
  };
  proposedLockMode: string;
  conflictingOperations: {
    selects: boolean;
    selectForUpdate: boolean;
    insertsUpdatesDeletes: boolean;
    vacuumAnalyze: boolean;
    concurrentIndexBuilds: boolean;
  };
  riskAssessment: {
    readerStarvationRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    applicationDowntimeRequired: boolean;
    lockQueueBlockingRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  };
  recommendations: string[];
  lockMatrix: Array<{
    operation: string;
    lockAcquired: string;
    conflictsWithProposed: boolean;
    impactDescription: string;
  }>;
}

const LOCK_CONFLICTS: Record<
  string,
  {
    selects: boolean;
    selectForUpdate: boolean;
    insertsUpdatesDeletes: boolean;
    vacuumAnalyze: boolean;
    concurrentIndexBuilds: boolean;
    starvation: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    downtime: boolean;
    queueRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }
> = {
  ACCESS_EXCLUSIVE: {
    selects: true,
    selectForUpdate: true,
    insertsUpdatesDeletes: true,
    vacuumAnalyze: true,
    concurrentIndexBuilds: true,
    starvation: 'CRITICAL',
    downtime: true,
    queueRisk: 'CRITICAL',
  },
  EXCLUSIVE: {
    selects: false,
    selectForUpdate: true,
    insertsUpdatesDeletes: true,
    vacuumAnalyze: true,
    concurrentIndexBuilds: true,
    starvation: 'HIGH',
    downtime: true,
    queueRisk: 'HIGH',
  },
  SHARE_ROW_EXCLUSIVE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: true,
    vacuumAnalyze: true,
    concurrentIndexBuilds: true,
    starvation: 'LOW',
    downtime: false,
    queueRisk: 'HIGH',
  },
  SHARE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: true,
    vacuumAnalyze: true,
    concurrentIndexBuilds: true,
    starvation: 'LOW',
    downtime: false,
    queueRisk: 'HIGH',
  },
  SHARE_UPDATE_EXCLUSIVE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: false,
    vacuumAnalyze: true,
    concurrentIndexBuilds: true,
    starvation: 'NONE',
    downtime: false,
    queueRisk: 'LOW',
  },
  ROW_EXCLUSIVE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: false,
    vacuumAnalyze: false,
    concurrentIndexBuilds: false,
    starvation: 'NONE',
    downtime: false,
    queueRisk: 'LOW',
  },
  ROW_SHARE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: false,
    vacuumAnalyze: false,
    concurrentIndexBuilds: false,
    starvation: 'NONE',
    downtime: false,
    queueRisk: 'LOW',
  },
  ACCESS_SHARE: {
    selects: false,
    selectForUpdate: false,
    insertsUpdatesDeletes: false,
    vacuumAnalyze: false,
    concurrentIndexBuilds: false,
    starvation: 'NONE',
    downtime: false,
    queueRisk: 'LOW',
  },
};

export class SimulateLockContentionHandler {
  public handle(args: SimulateLockContentionArgs): LockContentionOutput {
    const schema = args.schema || 'public';
    const table = args.table;
    const normalizedMode = (args.proposedLockMode || 'ACCESS_EXCLUSIVE')
      .toUpperCase()
      .replace(/\s+/g, '_');

    const conflictProfile = LOCK_CONFLICTS[normalizedMode] || LOCK_CONFLICTS['ACCESS_EXCLUSIVE'];

    const recommendations: string[] = [];

    if (conflictProfile.selects) {
      recommendations.push(
        'CRITICAL: This lock mode blocks all incoming SELECT queries. Set lock_timeout = "2s" and statement_timeout = "5s" to prevent queue pile-up.'
      );
      recommendations.push(
        'Execute this migration during maintenance windows or rewrite using zero-downtime multi-step patterns.'
      );
    } else if (conflictProfile.insertsUpdatesDeletes) {
      recommendations.push(
        'WARNING: Concurrent INSERT/UPDATE/DELETE queries will be blocked while this DDL executes.'
      );
    } else {
      recommendations.push(
        'SAFE: This lock mode allows concurrent application traffic (reads and writes) to continue uninterrupted.'
      );
    }

    const lockMatrix = [
      {
        operation: 'SELECT (Application Reads)',
        lockAcquired: 'ACCESS SHARE',
        conflictsWithProposed: conflictProfile.selects,
        impactDescription: conflictProfile.selects
          ? 'BLOCKED: Active readers will queue behind this transaction, causing latency spikes.'
          : 'ALLOWED: Reads proceed with zero latency impact.',
      },
      {
        operation: 'INSERT / UPDATE / DELETE (Application Writes)',
        lockAcquired: 'ROW EXCLUSIVE',
        conflictsWithProposed: conflictProfile.insertsUpdatesDeletes,
        impactDescription: conflictProfile.insertsUpdatesDeletes
          ? 'BLOCKED: Writes will stall until the DDL transaction commits.'
          : 'ALLOWED: Writes proceed normally.',
      },
      {
        operation: 'SELECT FOR UPDATE (Row Locking)',
        lockAcquired: 'ROW SHARE',
        conflictsWithProposed: conflictProfile.selectForUpdate,
        impactDescription: conflictProfile.selectForUpdate
          ? 'BLOCKED: Row-level lock requests will wait.'
          : 'ALLOWED: Row-level locks proceed.',
      },
      {
        operation: 'ANALYZE / VACUUM (Maintenance)',
        lockAcquired: 'SHARE UPDATE EXCLUSIVE',
        conflictsWithProposed: conflictProfile.vacuumAnalyze,
        impactDescription: conflictProfile.vacuumAnalyze
          ? 'BLOCKED: Background autovacuum will pause or be cancelled.'
          : 'ALLOWED: Background maintenance continues.',
      },
      {
        operation: 'CREATE INDEX CONCURRENTLY',
        lockAcquired: 'SHARE UPDATE EXCLUSIVE',
        conflictsWithProposed: conflictProfile.concurrentIndexBuilds,
        impactDescription: conflictProfile.concurrentIndexBuilds
          ? 'BLOCKED: Cannot run concurrently with heavy DDL.'
          : 'ALLOWED: Concurrent index builds can proceed.',
      },
    ];

    return {
      target: { schema, table },
      proposedLockMode: normalizedMode,
      conflictingOperations: {
        selects: conflictProfile.selects,
        selectForUpdate: conflictProfile.selectForUpdate,
        insertsUpdatesDeletes: conflictProfile.insertsUpdatesDeletes,
        vacuumAnalyze: conflictProfile.vacuumAnalyze,
        concurrentIndexBuilds: conflictProfile.concurrentIndexBuilds,
      },
      riskAssessment: {
        readerStarvationRisk: conflictProfile.starvation,
        applicationDowntimeRequired: conflictProfile.downtime,
        lockQueueBlockingRisk: conflictProfile.queueRisk,
      },
      recommendations,
      lockMatrix,
    };
  }
}
