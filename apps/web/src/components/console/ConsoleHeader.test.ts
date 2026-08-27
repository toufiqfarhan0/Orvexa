import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ConsoleHeader Responsive Layout & Class Hooks (Finding #6)', () => {
  const headerTsxPath = path.resolve(__dirname, 'ConsoleHeader.tsx');
  const consoleCssPath = path.resolve(__dirname, '../../styles/console.css');

  const headerTsx = fs.readFileSync(headerTsxPath, 'utf8');
  const consoleCss = fs.readFileSync(consoleCssPath, 'utf8');

  it('renders all semantic responsive CSS class names in markup', () => {
    expect(headerTsx).toContain('className="console-header-wrapper"');
    expect(headerTsx).toContain('className="console-header-container"');
    expect(headerTsx).toContain('className="console-header-divider"');
    expect(headerTsx).toContain('className="console-breadcrumb-subtitle"');
    expect(headerTsx).toContain('className="console-health-label"');
    expect(headerTsx).toContain('className="desktop-nav"');
  });

  it('contains mobile adaptation media queries in stylesheet for narrow viewports', () => {
    // Media query targeting mobile <= 640px
    expect(consoleCss).toMatch(/@media\s*\(max-width:\s*640px\)/);
    expect(consoleCss).toContain('.console-breadcrumb-subtitle');
    expect(consoleCss).toContain('.console-header-divider');
    expect(consoleCss).toContain('.desktop-nav');

    // Media query targeting narrow mobile <= 480px
    expect(consoleCss).toMatch(/@media\s*\(max-width:\s*480px\)/);
    expect(consoleCss).toContain('.console-health-label');
  });
});
