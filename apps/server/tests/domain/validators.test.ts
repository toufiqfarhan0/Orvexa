import { describe, it, expect } from 'vitest';
import {
  validateCreateSessionDto,
  validateTargetDatabase,
  validateProposedMigration,
  validateApprovalDecision,
} from '../../src/domain/validators.js';
import { ValidationError } from '../../src/domain/errors.js';
import type { CreateMigrationSessionDto, ApprovalDecision } from '@orvexa/shared';

describe('Domain Input Validators', () => {
  describe('validateCreateSessionDto', () => {
    it('passes on a valid DTO', () => {
      const validDto: CreateMigrationSessionDto = {
        targetDatabase: {
          engine: 'postgresql',
          version: '16.1',
          databaseName: 'production_db',
          schemaName: 'public',
          targetTable: 'users',
          estimatedRowCount: 500000,
          isProductionLike: true,
        },
        proposedMigration: {
          migrationId: 'mig-001',
          name: 'add_avatar_url_to_users',
          rawSql: 'ALTER TABLE users ADD COLUMN avatar_url text;',
          primaryOperation: 'ADD_COLUMN',
          plannedStatements: [
            {
              statementIndex: 0,
              sql: 'ALTER TABLE users ADD COLUMN avatar_url text;',
              operationType: 'ADD_COLUMN',
              targetObject: 'users.avatar_url',
            },
          ],
        },
      };

      expect(() => validateCreateSessionDto(validDto)).not.toThrow();
    });

    it('throws ValidationError when target database name is missing', () => {
      const invalidDto: CreateMigrationSessionDto = {
        targetDatabase: {
          engine: 'postgresql',
          version: '16.0',
          databaseName: '',
          schemaName: 'public',
          isProductionLike: true,
        },
        proposedMigration: {
          migrationId: 'mig-001',
          name: 'test',
          rawSql: 'SELECT 1;',
          primaryOperation: 'CUSTOM_DDL',
          plannedStatements: [],
        },
      };

      expect(() => validateCreateSessionDto(invalidDto)).toThrow(ValidationError);
      try {
        validateCreateSessionDto(invalidDto);
      } catch (err) {
        expect((err as ValidationError).validationErrors).toContain(
          'Target database name must be a non-empty string.'
        );
      }
    });

    it('throws ValidationError on unsupported database engine', () => {
      const invalidDb = {
        engine: 'mysql',
        version: '8.0',
        databaseName: 'test',
        schemaName: 'public',
        isProductionLike: false,
      } as unknown as TargetDatabaseMetadata;

      expect(() => validateTargetDatabase(invalidDb)).toThrow(ValidationError);
    });

    it('throws ValidationError when rawSql is empty or missing', () => {
      const invalidMigration = {
        name: 'test',
        rawSql: '   ',
        primaryOperation: 'CUSTOM_DDL',
        plannedStatements: [],
      } as unknown as ProposedMigration;

      expect(() => validateProposedMigration(invalidMigration)).toThrow(ValidationError);
    });
  });

  describe('validateApprovalDecision', () => {
    it('passes for a valid APPROVED decision', () => {
      const decision: ApprovalDecision = {
        decisionId: 'dec-1',
        approvalRequestId: 'req-1',
        status: 'APPROVED',
        approver: 'alice@company.com',
        decidedAt: new Date().toISOString(),
        comment: 'Verified with DBA team.',
      };

      expect(() => validateApprovalDecision(decision)).not.toThrow();
    });

    it('passes for a valid REJECTED decision with a rejection reason', () => {
      const decision: ApprovalDecision = {
        decisionId: 'dec-2',
        approvalRequestId: 'req-1',
        status: 'REJECTED',
        approver: 'bob@company.com',
        decidedAt: new Date().toISOString(),
        rejectionReason: 'Lock timeout risk too high during business hours.',
      };

      expect(() => validateApprovalDecision(decision)).not.toThrow();
    });

    it('throws ValidationError when REJECTED without a rejection reason', () => {
      const decision: ApprovalDecision = {
        decisionId: 'dec-3',
        approvalRequestId: 'req-1',
        status: 'REJECTED',
        approver: 'bob@company.com',
        decidedAt: new Date().toISOString(),
      };

      expect(() => validateApprovalDecision(decision)).toThrow(ValidationError);
    });

    it('throws ValidationError when approver identifier is missing', () => {
      const decision: ApprovalDecision = {
        decisionId: 'dec-4',
        approvalRequestId: 'req-1',
        status: 'APPROVED',
        approver: '',
        decidedAt: new Date().toISOString(),
      };

      expect(() => validateApprovalDecision(decision)).toThrow(ValidationError);
    });
  });
});
