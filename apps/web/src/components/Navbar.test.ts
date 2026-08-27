import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Navbar Mobile Overflow & CTA Resiliency (Qodo Finding #1)', () => {
  const navbarTsxPath = path.resolve(__dirname, 'Navbar.tsx');
  const indexCssPath = path.resolve(__dirname, '../styles/index.css');

  const navbarTsx = fs.readFileSync(navbarTsxPath, 'utf8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf8');

  it('renders required responsive CTA labels and status classes in markup', () => {
    expect(navbarTsx).toContain('className="nav-wrap"');
    expect(navbarTsx).toContain('nav-inner');
    expect(navbarTsx).toContain('className="nav-logo"');
    expect(navbarTsx).toContain('className="nav-right"');
    expect(navbarTsx).toContain('className="nav-health-label"');
    expect(navbarTsx).toContain('className="desktop-cta-label"');
    expect(navbarTsx).toContain('className="mobile-cta-label"');
    expect(navbarTsx).toContain('id="nav-cta-btn"');
  });

  it('contains narrow-mobile media query hiding health text to prevent button clipping', () => {
    expect(indexCss).toMatch(/@media\s*\(max-width:\s*480px\)/);
    expect(indexCss).toContain('.nav-health-label');

    // Asserts that indexCss defines mobile-cta-label display and hide rule for 480px
    const match480 = indexCss.match(/@media\s*\(max-width:\s*480px\)\s*\{([\s\S]*?)\n\}/);
    expect(match480).not.toBeNull();
    expect(match480![1]).toContain('.nav-health-label');
    expect(match480![1]).toContain('display: none');
  });

  it('contains ultra-narrow mobile breakpoint for 360px and 320px screens', () => {
    expect(indexCss).toMatch(/@media\s*\(max-width:\s*360px\)/);
    const match360 = indexCss.match(/@media\s*\(max-width:\s*360px\)\s*\{([\s\S]*?)\n\}/);
    expect(match360).not.toBeNull();
    expect(match360![1]).toContain('.nav-wrap');
    expect(match360![1]).toContain('.nav-inner');
    expect(match360![1]).toContain('#nav-cta-btn');
  });
});
