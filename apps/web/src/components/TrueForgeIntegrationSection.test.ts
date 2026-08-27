import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('TrueForgeIntegrationSection Registered MCP Tool Surfaces', () => {
  const compPath = path.resolve(__dirname, 'TrueForgeIntegrationSection.tsx');
  const content = fs.readFileSync(compPath, 'utf8');

  // ----------------------------------------------------------------
  // Tool 1 — inspect_postgres_target
  // ----------------------------------------------------------------
  it('advertises inspect_postgres_target (Tool 1/3)', () => {
    expect(content).toContain('inspect_postgres_target');
    expect(content).toContain('InspectPostgresTargetOutput');
  });

  // ----------------------------------------------------------------
  // Tool 2 — simulate_lock_contention  (added in PR #27)
  // ----------------------------------------------------------------
  it('advertises simulate_lock_contention (Tool 2/3)', () => {
    expect(content).toContain('simulate_lock_contention');
    expect(content).toContain('LockContentionSimulationOutput');
  });

  // ----------------------------------------------------------------
  // Tool 3 — generate_safe_migration_recipe  (added in PR #27)
  // ----------------------------------------------------------------
  it('advertises generate_safe_migration_recipe (Tool 3/3)', () => {
    expect(content).toContain('generate_safe_migration_recipe');
    expect(content).toContain('SafeMigrationRecipeOutput');
  });

  // ----------------------------------------------------------------
  // Catalog completeness: all 3 server-registered tools are present
  // ----------------------------------------------------------------
  it('mcpTools catalog is complete — all 3 server-registered tools present', () => {
    const registeredTools = [
      'inspect_postgres_target',
      'simulate_lock_contention',
      'generate_safe_migration_recipe',
    ];
    for (const tool of registeredTools) {
      expect(content).toContain(tool);
    }
  });

  // ----------------------------------------------------------------
  // No fictional / un-implemented tool names
  // ----------------------------------------------------------------
  it('does NOT contain fictional or un-implemented MCP tool names', () => {
    expect(content).not.toContain("fn: 'inspect_database'");
    expect(content).not.toContain("fn: 'analyze_migration'");
    expect(content).not.toContain("fn: 'rehearse_migration'");
    expect(content).not.toContain("fn: 'generate_executive_brief'");
    expect(content).not.toContain("fn: 'execute_live_migration'");
  });
});
