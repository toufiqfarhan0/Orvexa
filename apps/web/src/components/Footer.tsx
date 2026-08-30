import React from 'react';
import { ShieldCheck, GithubLogo, ArrowUpRight } from '@phosphor-icons/react';
import { useRouter, normalizePath } from '../router/Router.js';

/* Original shield logo mark for footer */
const FooterBrandLogo: React.FC = () => (
  <div
    style={{
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
    }}
  >
    <ShieldCheck size={16} weight="bold" />
  </div>
);

export const Footer: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const isLanding = normalizePath(currentPath) === '/';

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (!isLanding) {
      e.preventDefault();
      navigate(`/#${hash}`);
    }
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Left: Brand Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div
            className="footer-brand"
            style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}
          >
            <FooterBrandLogo />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Orvexa
            </span>
          </div>
          <span className="footer-copy">
            © {new Date().getFullYear()} Orvexa Platform. Precision-engineered PostgreSQL migration
            safety.
          </span>
        </div>

        {/* Right: Quick Links */}
        <div className="footer-links">
          <a
            href="#how-it-works"
            onClick={(e) => handleNav(e, 'how-it-works')}
            className="footer-link"
          >
            How It Works
          </a>
          <a
            href="#safety-architecture"
            onClick={(e) => handleNav(e, 'safety-architecture')}
            className="footer-link"
          >
            Safety
          </a>
          <a
            href="#integrations"
            onClick={(e) => handleNav(e, 'integrations')}
            className="footer-link"
          >
            Integrations
          </a>
          <a
            href="#interactive-proof"
            onClick={(e) => handleNav(e, 'interactive-proof')}
            className="footer-link"
          >
            Live Demo
          </a>
          <button
            onClick={() => navigate('/research')}
            className="footer-link"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 'inherit',
              padding: 0,
            }}
          >
            Research
          </button>
          <a
            href="https://github.com/toufiqfarhan0/Orvexa"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <GithubLogo size={16} />
            <span>Repository</span>
            <ArrowUpRight size={12} />
          </a>
        </div>
      </div>

      {/* Tech Stack Strip */}
      <div
        style={{
          maxWidth: 'var(--max-width)',
          margin: '2rem auto 0',
          padding: '1.25rem 2rem 0',
          borderTop: '1px solid var(--border-dim)',
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
          'Gemini Synthesis',
          'Fail-Closed DDL Execution',
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
