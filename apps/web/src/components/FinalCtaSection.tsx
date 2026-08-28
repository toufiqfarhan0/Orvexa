import React from 'react';
import { TerminalWindow, BookOpen, ShieldCheck } from '@phosphor-icons/react';

interface FinalCtaSectionProps {
  onOpenConsole: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenConsole }) => {
  return (
    <section
      className="section"
      style={{
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
      }}
    >
      <div className="container">
        <div className="cta-inner">
          {/* Background Atmospheric Effects */}
          <div className="cta-grid-overlay" />
          <div className="cta-glow" />

          {/* Core Content */}
          <div style={{ maxWidth: '58ch', margin: '0 auto', position: 'relative' }}>
            {/* Brand Shield Geometry */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.75rem auto',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              <ShieldCheck size={28} color="#ffffff" weight="bold" />
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
                style={{ padding: '0.9rem 2.25rem', fontSize: '0.9375rem', fontWeight: 700 }}
              >
                <TerminalWindow size={18} weight="bold" />
                <span>Launch Migration Console</span>
              </button>

              <a
                href="#safety-architecture"
                className="btn btn-white-outline"
                id="footer-secondary-cta"
                style={{ padding: '0.9rem 1.85rem', fontSize: '0.9375rem' }}
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
