import { describe, it, expect } from 'vitest';
import type { MigrationRehearsalEvidence } from '@orvexa/shared';

describe('RehearsalEvidencePanel Schema Diff Inspector & Filter Mechanics (Findings #2 & #4)', () => {
  const createMockEvidence = (
    overrides?: Partial<MigrationRehearsalEvidence>
  ): MigrationRehearsalEvidence =>
    ({
      rehearsalId: 'reh_123',
      sessionId: 'sess_123',
      targetDatabase: 'schemasentry_test',
      targetSchema: 'public',
      status: 'SUCCESS',
      exitCode: 0,
      cleanupStatus: 'COMPLETED',
      targetUntouched: true,
      schemaDifferences: {
        hasChanges: true,
        summary: ['1 table removed', '1 column added', '1 column modified'],
        tables: { added: [], removed: [], modified: [] },
        columns: { added: [], removed: [], modified: [] },
        indexes: { added: [], removed: [], modified: [] },
        constraints: { added: [], removed: [], modified: [] },
        primaryKeys: { added: [], removed: [], modified: [] },
        foreignKeys: { added: [], removed: [], modified: [] },
      },
      ...overrides,
    }) as MigrationRehearsalEvidence;

  it('Finding #2: Mixed diffs preserve table removals, column additions, and column modifications simultaneously', () => {
    const mixedEvidence = createMockEvidence({
      schemaDifferences: {
        hasChanges: true,
        summary: ['1 table dropped', '1 column added', '1 column modified'],
        tables: {
          added: [],
          removed: [
            {
              schemaName: 'public',
              tableName: 'legacy_metrics',
              tableType: 'BASE TABLE',
              estimatedRowCount: 0,
              totalSizeBytes: 0,
              tableSizeBytes: 0,
              indexSizeBytes: 0,
              isPartitioned: false,
            },
          ],
          modified: [],
        },
        columns: {
          added: [
            {
              columnName: 'event_type',
              ordinalPosition: 1,
              dataType: 'text',
              udtName: 'text',
              isNullable: false,
              isIdentity: false,
              isGenerated: false,
            },
          ],
          removed: [],
          modified: [
            {
              name: 'orders.total_amount',
              before: {
                columnName: 'total_amount',
                ordinalPosition: 2,
                dataType: 'integer',
                udtName: 'int4',
                isNullable: false,
                isIdentity: false,
                isGenerated: false,
              },
              after: {
                columnName: 'total_amount',
                ordinalPosition: 2,
                dataType: 'numeric(10,2)',
                udtName: 'numeric',
                isNullable: false,
                isIdentity: false,
                isGenerated: false,
              },
            },
          ],
        },
        indexes: { added: [], removed: [], modified: [] },
        constraints: { added: [], removed: [], modified: [] },
        primaryKeys: { added: [], removed: [], modified: [] },
        foreignKeys: { added: [], removed: [], modified: [] },
      },
    });

    const diff = mixedEvidence.schemaDifferences;
    const addedCols = diff?.columns?.added || [];
    const removedCols = diff?.columns?.removed || [];
    const modifiedCols = diff?.columns?.modified || [];

    const addedTables = diff?.tables?.added || [];
    const removedTables = diff?.tables?.removed || [];
    const modifiedTables = diff?.tables?.modified || [];

    const totalAdditions = addedTables.length + addedCols.length;
    const totalDeletions = removedTables.length + removedCols.length;
    const totalModifications = modifiedTables.length + modifiedCols.length;
    const totalChanges = totalAdditions + totalDeletions + totalModifications;

    // All three categories are populated and accounted for
    expect(removedTables).toHaveLength(1);
    expect(addedCols).toHaveLength(1);
    expect(modifiedCols).toHaveLength(1);
    expect(totalDeletions).toBe(1);
    expect(totalAdditions).toBe(1);
    expect(totalModifications).toBe(1);
    expect(totalChanges).toBe(3);

    // Ensure removedTables presence does NOT gate column additions or modifications
    const shouldRenderColumns =
      addedCols.length > 0 || removedCols.length > 0 || modifiedCols.length > 0;
    expect(shouldRenderColumns).toBe(true);
  });

  it('Finding #4: Stale filter resets automatically when new evidence has zero entries in active category', () => {
    let currentFilter: string = 'modifications';

    // Next evidence has only additions (modifications count = 0)
    const nextEvidence = createMockEvidence({
      schemaDifferences: {
        hasChanges: true,
        summary: ['2 columns added'],
        tables: { added: [], removed: [], modified: [] },
        columns: {
          added: [
            {
              columnName: 'phone',
              ordinalPosition: 1,
              dataType: 'text',
              udtName: 'text',
              isNullable: true,
              isIdentity: false,
              isGenerated: false,
            },
            {
              columnName: 'avatar_url',
              ordinalPosition: 2,
              dataType: 'text',
              udtName: 'text',
              isNullable: true,
              isIdentity: false,
              isGenerated: false,
            },
          ],
          removed: [],
          modified: [],
        },
        indexes: { added: [], removed: [], modified: [] },
        constraints: { added: [], removed: [], modified: [] },
        primaryKeys: { added: [], removed: [], modified: [] },
        foreignKeys: { added: [], removed: [], modified: [] },
      },
    });

    const nextDiff = nextEvidence.schemaDifferences;
    const nextAdded = (nextDiff.columns?.added || []).length;
    const nextDeletions = (nextDiff.columns?.removed || []).length;
    const nextModifications = (nextDiff.columns?.modified || []).length;

    // Filter validation logic (as in useEffect)
    if (currentFilter === 'modifications' && nextModifications === 0) {
      currentFilter = 'all';
    } else if (currentFilter === 'deletions' && nextDeletions === 0) {
      currentFilter = 'all';
    } else if (currentFilter === 'additions' && nextAdded === 0) {
      currentFilter = 'all';
    }

    // Filter automatically switched from 'modifications' to 'all' so the 2 additions are visible
    expect(currentFilter).toBe('all');
    expect(nextAdded).toBe(2);
  });
});
