import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Console Design Tokens Static Audit (Finding #1)', () => {
  const consoleCssPath = path.resolve(__dirname, 'console.css');
  const indexCssPath = path.resolve(__dirname, 'index.css');

  const consoleCss = fs.readFileSync(consoleCssPath, 'utf8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf8');

  it('declares scoped console tokens and avoids leaking to global :root', () => {
    expect(consoleCss).toContain('.console-root,');
    expect(consoleCss).toContain('.console-header-wrapper,');
    expect(consoleCss).toContain('.telemetry-modal-overlay');
    // Ensure console.css does not override global :root variables
    expect(consoleCss).not.toMatch(/^:root\s*\{/m);
  });

  it('guarantees all custom properties referenced in console.css are defined in index.css or console.css', () => {
    const varReferences = consoleCss.match(/var\(--[a-zA-Z0-9_-]+/g) || [];
    const uniqueVars = [...new Set(varReferences.map((v) => v.replace('var(', '')))];

    expect(uniqueVars.length).toBeGreaterThan(15);

    for (const v of uniqueVars) {
      const definedInIndex = indexCss.includes(`${v}:`);
      const definedInConsole = consoleCss.includes(`${v}:`);
      expect(
        definedInIndex || definedInConsole,
        `Expected CSS variable ${v} to be defined in index.css or console.css`
      ).toBe(true);
    }
  });

  it('defines core tokens (--bg-base, --bg-elevated, --border-faint, --green, --red, --shadow-xs)', () => {
    const requiredTokens = [
      '--bg-base',
      '--bg-elevated',
      '--border-faint',
      '--green',
      '--red',
      '--shadow-xs',
    ];

    for (const token of requiredTokens) {
      expect(consoleCss).toContain(`${token}:`);
      expect(indexCss).toContain(`${token}:`);
    }
  });
});
