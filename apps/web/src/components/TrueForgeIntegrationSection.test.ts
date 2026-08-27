import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('TrueForgeIntegrationSection Registered MCP Tool Surfaces (Qodo Finding #2)', () => {
  const compPath = path.resolve(__dirname, 'TrueForgeIntegrationSection.tsx');
  const content = fs.readFileSync(compPath, 'utf8');

  it('advertises only canonical registered inspect_postgres_target MCP tool', () => {
    expect(content).toContain('inspect_postgres_target');
    expect(content).toContain('InspectPostgresTargetOutput');
  });

  it('does NOT contain fictional or un-implemented MCP tool names', () => {
    expect(content).not.toContain("fn: 'inspect_database'");
    expect(content).not.toContain("fn: 'analyze_migration'");
    expect(content).not.toContain("fn: 'rehearse_migration'");
    expect(content).not.toContain("fn: 'generate_executive_brief'");
    expect(content).not.toContain("fn: 'execute_live_migration'");
  });
});
