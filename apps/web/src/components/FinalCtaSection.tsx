import React from 'react';
import { TerminalWindow, BookOpen, ShieldCheck } from '@phosphor-icons/react';

interface FinalCtaSectionProps {
  onOpenConsole: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenConsole }) => {
  return (
    <section className="section-spacing" style={{ borderBottom: '1px solid var(--border-dim)' }}>
      <div className="app-container">
        <div
          className="panel"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            backgroundColor: '#090b12',
            border: '1px solid var(--border-medium)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ maxWidth: '58ch', margin: '0 auto' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                margin: '0 auto 1.5rem auto',
              }}
            >
              <ShieldCheck size={28} weight="bold" />
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: '1rem',
                color: '#ffffff',
              }}
            >
              See what your migration will do before production.
            </h2>

            <p
              style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              Eliminate blind DDL runs. Orvexa orchestrates full rehearsal, cryptographic approvals,
              and automated parity probes for every PostgreSQL change.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={onOpenConsole}
                className="btn btn-primary"
                id="footer-primary-cta"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <TerminalWindow size={18} weight="bold" />
                <span>Launch Migration Console</span>
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-secondary"
                id="footer-secondary-cta"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <BookOpen size={18} weight="bold" />
                <span>View Architecture</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
