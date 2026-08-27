import { describe, it, expect } from 'vitest';
import { GenerateRecipeHandler } from '../../src/mcp/handlers/generate-recipe.handler.js';

describe('GenerateRecipeHandler', () => {
  const handler = new GenerateRecipeHandler();

  it('generates zero-downtime recipe for adding a NOT NULL column', () => {
    const result = handler.handle({
      operation: 'add_not_null_column',
      table: 'accounts',
      column: 'tier',
      columnType: 'varchar(50)',
      defaultValue: "'standard'",
    });

    expect(result.zeroDowntimeGuaranteed).toBe(true);
    expect(result.steps.length).toBe(5);
    expect(result.completeSql).toContain('ADD COLUMN tier');
    expect(result.completeSql).toContain('VALIDATE CONSTRAINT');
    expect(result.rollbackSql).toContain('DROP CONSTRAINT');
  });

  it('generates CREATE INDEX CONCURRENTLY recipe', () => {
    const result = handler.handle({
      operation: 'create_index',
      table: 'transactions',
      column: 'created_at',
    });

    expect(result.zeroDowntimeGuaranteed).toBe(true);
    expect(result.completeSql).toContain('CREATE INDEX CONCURRENTLY');
    expect(result.rollbackSql).toContain('DROP INDEX CONCURRENTLY');
  });

  it('generates 2-phase non-blocking foreign key recipe', () => {
    const result = handler.handle({
      operation: 'add_foreign_key',
      table: 'orders',
      column: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
    });

    expect(result.zeroDowntimeGuaranteed).toBe(true);
    expect(result.completeSql).toContain('NOT VALID');
    expect(result.completeSql).toContain('VALIDATE CONSTRAINT');
  });
});
