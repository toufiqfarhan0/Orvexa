import React from 'react';
import { TerminalWindow, BookOpen } from '@phosphor-icons/react';

interface FinalCtaSectionProps {
  onOpenConsole: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenConsole }) => {
  return (
    <section
      className="section"
      style={{ borderTop: '1px solid var(--border-faint)', background: 'var(--bg-base)' }}
    >
      <div className="container">
        <div className="cta-inner">
          {/* Background effects */}
          <div className="cta-grid-overlay" />
          <div className="cta-glow" />

          {/* Content */}
          <div style={{ maxWidth: '56ch', margin: '0 auto', position: 'relative' }}>
            {/* Icon mark */}
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 2rem auto',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <polygon
                  points="14,2 26,8 26,20 14,26 2,20 2,8"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.75"
                  fill="rgba(255,255,255,0.06)"
                />
                <circle cx="14" cy="14" r="3" fill="white" />
              </svg>
            </div>

            <h2 className="cta-h2">
              See what your migration
              <br />
              will do — before production.
            </h2>

            <p className="cta-sub">
              Eliminate blind DDL runs. Orvexa orchestrates full rehearsal, cryptographic approvals,
              and automated parity probes for every PostgreSQL change.
            </p>

            <div className="cta-actions">
              <button
                onClick={onOpenConsole}
                className="btn btn-white"
                id="footer-primary-cta"
                style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem', fontWeight: 700 }}
              >
                <TerminalWindow size={18} weight="bold" />
                Launch Migration Console
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-white-outline"
                id="footer-secondary-cta"
                style={{ padding: '0.875rem 1.75rem', fontSize: '0.9375rem' }}
              >
                <BookOpen size={18} weight="bold" />
                View Architecture
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
