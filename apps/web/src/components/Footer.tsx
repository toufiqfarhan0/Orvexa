import React from 'react';
import { ShieldCheck, GithubLogo } from '@phosphor-icons/react';

/* Original shield logo mark for footer */
const FooterBrandLogo = () => (
  <div
    style={{
      width: '26px',
      height: '26px',
      borderRadius: '7px',
      backgroundColor: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
    }}
  >
    <ShieldCheck size={15} weight="bold" />
  </div>
);

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Left: brand */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div
            className="footer-brand"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FooterBrandLogo />
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.9375rem',
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Orvexa
            </span>
          </div>
          <span className="footer-copy">
            © {new Date().getFullYear()} Orvexa Platform. Deterministic PostgreSQL migration safety.
          </span>
        </div>

        {/* Right: links */}
        <div className="footer-links">
          <a href="#how-it-works" className="footer-link">
            How It Works
          </a>
          <a href="#safety-architecture" className="footer-link">
            Safety
          </a>
          <a href="#integrations" className="footer-link">
            Integrations
          </a>
          <a href="#interactive-proof" className="footer-link">
            Live Demo
          </a>
          <a
            href="https://github.com/toufiqfarhan0/Orvexa"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <GithubLogo size={15} />
            Repository
          </a>
        </div>
      </div>

      {/* Tech stack strip */}
      <div
        style={{
          maxWidth: 'var(--max-width)',
          margin: '1.5rem auto 0',
          padding: '1rem 2rem 0',
          borderTop: '1px solid var(--border-faint)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {[
          'PostgreSQL 16',
          'TrueForge MCP Server',
          'Daytona Isolated Sandboxes',
          'SHA-256 Fingerprinting',
        ].map((t) => (
          <span
            key={t}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </footer>
  );
};
