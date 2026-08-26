import pg from 'pg';
import type { TargetDatabaseMetadata } from '@orvexa/shared';
import type {
  PostgresExecutionPort,
  LiveExecutionResult,
  StatementExecutionOutcome,
} from '../ports/postgres-execution.port.js';
import {
  sanitizeConnectionString,
  sanitizeErrorMessage,
  isValidIdentifier,
  escapeIdentifier,
} from '../../db/utils/sanitizer.js';
import { config as appConfig } from '../../config/env.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';
import { PostgresTransactionClassifier } from '../utils/transaction-classifier.js';

const { Pool } = pg;

export interface PostgresExecutionAdapterOptions {
  connectionString?: string;
  defaultTimeoutMs?: number;
  logger?: TrueForgeLogger;
  injectedPool?: pg.Pool;
}

/**
 * Controlled live execution adapter for PostgreSQL targets.
 * Enforces transaction policies, bounded statement timeouts, and strict error isolation.
 */
export class PostgresExecutionAdapter implements PostgresExecutionPort {
  private readonly defaultConnectionString: string;
  private readonly defaultTimeoutMs: number;
  private readonly logger: TrueForgeLogger;
  private readonly injectedPool?: pg.Pool;

  constructor(options: PostgresExecutionAdapterOptions = {}) {
    this.defaultConnectionString =
      options.connectionString ||
      appConfig.databaseUrl ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000;
    this.logger = options.logger || new TrueForgeLogger('[SchemaSentry:LiveExecution]');
    this.injectedPool = options.injectedPool;
  }

  /**
   * Builds the database connection string for a given target database.
   */
  private resolveConnectionString(target: TargetDatabaseMetadata): string {
    const raw = target.connectionString || this.defaultConnectionString;
    try {
      const url = new URL(raw);
      if (target.databaseName && target.databaseName.trim().length > 0) {
        url.pathname = `/${target.databaseName.trim()}`;
      }
      return url.toString();
    } catch {
      return raw;
    }
  }

  /**
   * Acquires a connected client for the target database.
   */
  private async getClient(
    target: TargetDatabaseMetadata
  ): Promise<{ client: pg.PoolClient | pg.Client; release: () => Promise<void> | void }> {
    if (this.injectedPool) {
      const client = await this.injectedPool.connect();
      return { client, release: () => client.release() };
    }

    const connStr = this.resolveConnectionString(target);
    const pool = new Pool({
      connectionString: connStr,
      connectionTimeoutMillis: 5000,
      statement_timeout: this.defaultTimeoutMs,
      max: 2,
    });

    const client = await pool.connect();
    return {
      client,
      release: async () => {
        client.release();
        await pool.end();
      },
    };
  }

  /**
   * Verifies connectivity to the target database and measures round-trip latency.
   */
  public async verifyTargetConnectivity(
    target: TargetDatabaseMetadata
  ): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();

    if (target.schemaName && target.schemaName.trim() !== '') {
      if (!isValidIdentifier(target.schemaName)) {
        return {
          connected: false,
          latencyMs: 0,
          error: `Invalid target schema identifier: "${target.schemaName}". Must match /^[a-zA-Z_][a-zA-Z0-9_$]*$/ and <= 63 characters.`,
        };
      }
    }

    try {
      const { client, release } = await this.getClient(target);
      try {
        await client.query('SELECT 1 AS health_check;');
        const latencyMs = Math.round(performance.now() - start);
        return { connected: true, latencyMs };
      } finally {
        await release();
      }
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const rawMsg = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        latencyMs,
        error: sanitizeErrorMessage(rawMsg),
      };
    }
  }

  /**
   * Executes the exact sequence of approved migration statements against the target database.
   */
  public async executeApprovedMigration(
    target: TargetDatabaseMetadata,
    statements: string[],
    options?: { timeoutMs?: number; statementTimeoutMs?: number }
  ): Promise<LiveExecutionResult> {
    const startTime = performance.now();
    const timeoutMs = options?.statementTimeoutMs || options?.timeoutMs || this.defaultTimeoutMs;
    const sanitizedTarget = sanitizeConnectionString(this.resolveConnectionString(target));

    this.logger.info('Starting controlled live execution', {
      databaseName: target.databaseName,
      schemaName: target.schemaName,
      statementsCount: statements.length,
      target: sanitizedTarget,
    });

    // 1. Strict Target Schema Name Identifier Validation
    if (target.schemaName && target.schemaName.trim() !== '') {
      if (!isValidIdentifier(target.schemaName)) {
        const failReason = `Invalid target schema identifier: "${target.schemaName}". Must be a valid PostgreSQL identifier matching /^[a-zA-Z_][a-zA-Z0-9_$]*$/ and <= 63 characters.`;
        this.logger.error('Target schema validation failed (invalid identifier)', {
          schemaName: target.schemaName,
        });

        return {
          success: false,
          statementsExecuted: 0,
          statementsFailed: 1,
          totalDurationMs: 0,
          statementResults: [
            {
              statementIndex: 0,
              sql: statements[0] || '',
              executionTimeMs: 0,
              status: 'FAILED',
              errorMessage: failReason,
              errorCode: 'INVALID_SCHEMA_IDENTIFIER',
            },
          ],
          errorMessage: failReason,
          errorCode: 'INVALID_SCHEMA_IDENTIFIER',
        };
      }
    }

    // 2. Fail Closed Classification Validation
    const batch = PostgresTransactionClassifier.classifyBatch(statements);
    if (!batch.valid) {
      const hasDml = batch.classifications.some((c) => c.operation === 'UNSUPPORTED_DML');
      const errorCode = hasDml ? 'UNSUPPORTED_DML' : 'UNSUPPORTED_STATEMENT';
      const failReason = `Live execution rejected: ${batch.unsupportedReasons.join('; ')}`;
      this.logger.error('Statement transaction classification failed (unsupported statements)', {
        reasons: batch.unsupportedReasons,
        errorCode,
      });

      return {
        success: false,
        statementsExecuted: 0,
        statementsFailed: 1,
        totalDurationMs: 0,
        statementResults: [
          {
            statementIndex: 0,
            sql: statements[0] || '',
            executionTimeMs: 0,
            status: 'FAILED',
            errorMessage: failReason,
            errorCode,
          },
        ],
        errorMessage: failReason,
        errorCode,
      };
    }

    const statementResults: StatementExecutionOutcome[] = [];
    let statementsExecuted = 0;
    let statementsFailed = 0;
    let globalError: string | undefined;
    let globalErrorCode: string | undefined;

    let client: pg.PoolClient | pg.Client | null = null;
    let release: (() => Promise<void> | void) | null = null;

    try {
      const acquired = await this.getClient(target);
      client = acquired.client;
      release = acquired.release;

      // Apply bounded statement timeout (minimum 1ms)
      const effectiveTimeout = Math.max(1, Math.floor(timeoutMs));
      await client.query(`SET statement_timeout = ${effectiveTimeout};`);

      if (target.schemaName && target.schemaName !== 'public') {
        const safeSchema = escapeIdentifier(target.schemaName, 'schemaName');
        await client.query(`SET search_path TO ${safeSchema}, public;`);
      }

      if (batch.allTransactionSafe && statements.length > 0) {
        // Run inside single atomic transaction
        this.logger.info('Executing statements within atomic transaction (BEGIN...COMMIT)');
        await client.query('BEGIN;');

        try {
          for (let i = 0; i < statements.length; i++) {
            const stmtSql = statements[i];
            const stmtStart = performance.now();

            try {
              const res = await client.query(stmtSql);
              const stmtDuration = Math.round(performance.now() - stmtStart);
              statementsExecuted++;

              statementResults.push({
                statementIndex: i,
                sql: stmtSql,
                executionTimeMs: stmtDuration,
                rowsAffected: typeof res.rowCount === 'number' ? res.rowCount : 0,
                command: res.command,
                status: 'SUCCESS',
              });
            } catch (stmtErr: unknown) {
              const stmtDuration = Math.round(performance.now() - stmtStart);
              statementsFailed++;
              const errMsg = stmtErr instanceof Error ? stmtErr.message : String(stmtErr);
              const errCode = (stmtErr as { code?: string })?.code;
              const sanitizedMsg = sanitizeErrorMessage(errMsg);

              statementResults.push({
                statementIndex: i,
                sql: stmtSql,
                executionTimeMs: stmtDuration,
                status: 'FAILED',
                errorMessage: sanitizedMsg,
                errorCode: errCode,
              });

              globalError = sanitizedMsg;
              globalErrorCode = errCode;
              throw stmtErr; // Triggers transaction ROLLBACK
            }
          }

          await client.query('COMMIT;');
          this.logger.info('Transaction successfully committed');
        } catch (txErr: unknown) {
          try {
            await client.query('ROLLBACK;');
            this.logger.warn('Transaction rolled back due to statement failure');
          } catch (rollbackErr: unknown) {
            this.logger.error('Error rolling back transaction', {
              error: sanitizeErrorMessage(String(rollbackErr)),
            });
          }
          if (!globalError) {
            globalError = sanitizeErrorMessage(
              txErr instanceof Error ? txErr.message : String(txErr)
            );
          }
        }
      } else {
        // Sequential non-transactional execution (e.g. CREATE INDEX CONCURRENTLY)
        this.logger.info('Executing statements sequentially (non-transactional DDL)');
        for (let i = 0; i < statements.length; i++) {
          const stmtSql = statements[i];
          const stmtStart = performance.now();

          try {
            const res = await client.query(stmtSql);
            const stmtDuration = Math.round(performance.now() - stmtStart);
            statementsExecuted++;

            statementResults.push({
              statementIndex: i,
              sql: stmtSql,
              executionTimeMs: stmtDuration,
              rowsAffected: typeof res.rowCount === 'number' ? res.rowCount : 0,
              command: res.command,
              status: 'SUCCESS',
            });
          } catch (stmtErr: unknown) {
            const stmtDuration = Math.round(performance.now() - stmtStart);
            statementsFailed++;
            const errMsg = stmtErr instanceof Error ? stmtErr.message : String(stmtErr);
            const errCode = (stmtErr as { code?: string })?.code;
            const sanitizedMsg = sanitizeErrorMessage(errMsg);

            statementResults.push({
              statementIndex: i,
              sql: stmtSql,
              executionTimeMs: stmtDuration,
              status: 'FAILED',
              errorMessage: sanitizedMsg,
              errorCode: errCode,
            });

            globalError = sanitizedMsg;
            globalErrorCode = errCode;
            break; // Stop immediately on failure; do NOT invent destructive follow-up SQL
          }
        }
      }
    } catch (connErr: unknown) {
      const errMsg = connErr instanceof Error ? connErr.message : String(connErr);
      globalError = sanitizeErrorMessage(errMsg);
      globalErrorCode = (connErr as { code?: string })?.code || 'CONNECTION_ERROR';
      statementsFailed++;
    } finally {
      if (release) {
        try {
          await release();
        } catch {
          // Ignore release errors
        }
      }
    }

    const totalDurationMs = Math.round(performance.now() - startTime);
    const success = statementsFailed === 0 && statementsExecuted === statements.length;

    this.logger.info('Live execution finished', {
      success,
      statementsExecuted,
      statementsFailed,
      totalDurationMs,
      error: globalError,
    });

    return {
      success,
      statementsExecuted,
      statementsFailed,
      totalDurationMs,
      statementResults,
      errorMessage: globalError,
      errorCode: globalErrorCode,
    };
  }
}
