import React from 'react';
import { TerminalWindow, BookOpen, ShieldCheck } from '@phosphor-icons/react';

interface FinalCtaSectionProps {
  onOpenConsole: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenConsole }) => {
  return (
    <section
      className="section-spacing"
      style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
    >
      <div className="app-container">
        <div
          style={{
            background: 'var(--text-primary)',
            borderRadius: '24px',
            padding: '4rem 2.5rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle background texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 70% 60% at 50% 110%, rgba(249,115,22,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ maxWidth: '56ch', margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                margin: '0 auto 1.75rem auto',
              }}
            >
              <ShieldCheck size={28} weight="bold" />
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                marginBottom: '1rem',
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              See what your migration will do before production.
            </h2>

            <p
              style={{
                fontSize: '1.0625rem',
                color: 'rgba(255,255,255,0.65)',
                marginBottom: '2.25rem',
                lineHeight: 1.65,
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
                gap: '0.875rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={onOpenConsole}
                className="btn"
                id="footer-primary-cta"
                style={{
                  padding: '0.875rem 2rem',
                  fontSize: '0.9375rem',
                  background: '#ffffff',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
              >
                <TerminalWindow size={18} weight="bold" />
                <span>Launch Migration Console</span>
              </button>

              <a
                href="#safety-architecture"
                className="btn"
                id="footer-secondary-cta"
                style={{
                  padding: '0.875rem 1.75rem',
                  fontSize: '0.9375rem',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontWeight: 600,
                }}
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
