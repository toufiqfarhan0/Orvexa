import type { MigrationSession, TargetDatabaseMetadata } from '@orvexa/shared';
import type { MigrationSessionRepository } from '../repositories/session.repository.interface.js';
import type {
  CompleteAnalysisOutput,
  DatabaseAnalysisContext,
  MigrationAnalyzer,
} from '../analyzer/interfaces/migration-analyzer.interface.js';
import { MigrationAnalyzerService } from '../analyzer/services/migration-analyzer.service.js';
import type { PostgresInspectionPort } from '../db/ports/postgres-inspection.port.js';
import { PostgresInspectionService } from '../db/services/postgres-inspection.service.js';
import { IllegalActionError, SessionNotFoundError } from '../domain/errors.js';

export type PostgresInspectionPortProvider =
  | PostgresInspectionPort
  | PostgresInspectionService
  | ((
      targetDatabase: TargetDatabaseMetadata
    ) => Promise<PostgresInspectionPort> | PostgresInspectionPort);

export interface MigrationAnalysisServiceOptions {
  analyzer?: MigrationAnalyzer;
  inspectionPortProvider?: PostgresInspectionPortProvider;
}

export interface AnalyzeMigrationSessionOptions {
  actor?: string;
  inspectionPort?: PostgresInspectionPort | PostgresInspectionService;
  customContext?: DatabaseAnalysisContext;
}

/**
 * MigrationAnalysisService - Application Service Orchestrator connecting
 * Migration Sessions, Target PostgreSQL Inspection, and Deterministic Static Risk Analysis.
 */
export class MigrationAnalysisService {
  private readonly analyzer: MigrationAnalyzer;
  private readonly inspectionPortProvider?: PostgresInspectionPortProvider;

  constructor(
    private readonly repository: MigrationSessionRepository,
    options?: MigrationAnalysisServiceOptions
  ) {
    this.analyzer = options?.analyzer ?? new MigrationAnalyzerService();
    this.inspectionPortProvider = options?.inspectionPortProvider;
  }

  /**
   * Resolves the PostgresInspectionPort from the configured provider or options.
   */
  private async resolveInspectionPort(
    targetDatabase: TargetDatabaseMetadata,
    overridePort?: PostgresInspectionPort | PostgresInspectionService
  ): Promise<PostgresInspectionPort | undefined> {
    if (overridePort) {
      if (overridePort instanceof PostgresInspectionService) {
        return overridePort.getPort();
      }
      return overridePort;
    }

    if (!this.inspectionPortProvider) {
      return undefined;
    }

    if (typeof this.inspectionPortProvider === 'function') {
      return await this.inspectionPortProvider(targetDatabase);
    }

    if (this.inspectionPortProvider instanceof PostgresInspectionService) {
      return this.inspectionPortProvider.getPort();
    }

    return this.inspectionPortProvider;
  }

  /**
   * Runs the complete end-to-end static migration analysis for a given migration session.
   * Loads target database catalog metadata, executes deterministic rules, records
   * findings and risk assessment on the session, and transitions the session state appropriately.
   */
  public async analyzeMigrationSession(
    sessionId: string,
    options?: AnalyzeMigrationSessionOptions
  ): Promise<{
    session: MigrationSession;
    analysisOutput: CompleteAnalysisOutput;
  }> {
    const entity = await this.repository.findById(sessionId);
    if (!entity) {
      throw new SessionNotFoundError(sessionId);
    }

    // Validate that session can begin analysis
    if (entity.status !== 'DRAFT' && entity.status !== 'ANALYSIS_FAILED') {
      throw new IllegalActionError(
        `Cannot start analysis for session in '${entity.status}' status.`,
        'Session must be in DRAFT or ANALYSIS_FAILED status.'
      );
    }

    const actor = options?.actor ?? 'migration-analysis-orchestrator';

    // Step 1: Transition to ANALYZING
    entity.beginAnalysis(actor);
    await this.repository.save(entity);

    try {
      // Step 2: Build Database Analysis Context
      const inspectionPort = await this.resolveInspectionPort(
        entity.request.targetDatabase,
        options?.inspectionPort
      );

      if (inspectionPort) {
        await inspectionPort.verifyConnectivity();
      }

      const context: DatabaseAnalysisContext = {
        inspectionPort,
        server: options?.customContext?.server,
        tables: options?.customContext?.tables,
        tableInspections: options?.customContext?.tableInspections,
      };

      // Step 3: Run Deterministic Migration Analyzer
      const analysisOutput = await this.analyzer.analyze(entity.request.proposedMigration, context);

      // Step 4: Record Analysis Result & Risk Assessment
      // Automatically transitions to SANDBOX_READY (if safe) or ANALYSIS_FAILED (if blockers)
      entity.recordAnalysisResult(
        analysisOutput.analysisResult,
        analysisOutput.riskAssessment,
        actor
      );

      await this.repository.save(entity);

      return {
        session: entity.toSnapshot(),
        analysisOutput,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      entity.recordAnalysisFailure(errorMessage, actor);
      await this.repository.save(entity);
      throw err;
    }
  }
}
