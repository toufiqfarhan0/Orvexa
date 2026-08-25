import React from 'react';
import { ShieldCheck, GithubLogo } from '@phosphor-icons/react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        paddingTop: '3.5rem',
        paddingBottom: '3.5rem',
        backgroundColor: '#06070a',
        borderTop: '1px solid var(--border-dim)',
      }}
    >
      <div className="app-container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid var(--border-dim)',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-btn)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <ShieldCheck size={18} weight="bold" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              Orvexa
            </span>
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
                marginLeft: '0.5rem',
              }}
            >
              Mission Control for Safe Database Changes
            </span>
          </div>

          {/* Links */}
          <div
            className="footer-nav-links"
            style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}
          >
            <a
              href="#how-it-works"
              className="btn-ghost btn"
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
            >
              How It Works
            </a>
            <a
              href="#safety-architecture"
              className="btn-ghost btn"
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
            >
              Safety Architecture
            </a>
            <a
              href="#trueforge-platform"
              className="btn-ghost btn"
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
            >
              TrueForge Platform
            </a>
            <a
              href="https://github.com/toufiqfarhan0/Orvexa"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn"
              style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
            >
              <GithubLogo size={16} />
              <span>Repository</span>
            </a>
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            &copy; {new Date().getFullYear()} Orvexa Platform. Deterministic PostgreSQL migration
            safety.
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span>PostgreSQL 16 Engine</span>
            <span>TrueForge MCP Server</span>
            <span>Daytona Isolated Sandboxes</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
