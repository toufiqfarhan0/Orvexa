import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('WorkflowSection Pipeline Stage Consistency (Qodo Finding #3)', () => {
  const compPath = path.resolve(__dirname, 'WorkflowSection.tsx');
  const heroPath = path.resolve(__dirname, 'HeroSection.tsx');

  const compContent = fs.readFileSync(compPath, 'utf8');
  const heroContent = fs.readFileSync(heroPath, 'utf8');

  it('renders a Six-stage safety heading matching the 6 rendered steps', () => {
    expect(compContent).toContain('Six-stage safety');
    expect(compContent).not.toContain('Five-stage safety');
  });

  it('contains exactly 6 workflow step definitions matching hero pipeline', () => {
    expect(compContent).toContain('Deterministic Risk Analysis');
    expect(compContent).toContain('Daytona Sandbox Rehearsal');
    expect(compContent).toContain('Executive Release Brief');
    expect(compContent).toContain('Human Approval Gate');
    expect(compContent).toContain('Controlled Live Execution');
    expect(compContent).toContain('Catalog Parity Verification');

    // Hero section defines 6 numbered stages
    expect(heroContent).toContain("num: '01'");
    expect(heroContent).toContain("num: '06'");
  });
});
