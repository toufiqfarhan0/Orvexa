import React from 'react';
import {
  ShieldWarning,
  ListMagnifyingGlass,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import type { RiskCategory } from '@orvexa/shared';
import type { ApiSessionData } from '../../services/migration-api.service.js';

interface RiskPreviewPanelProps {
  analysisResult?: ApiSessionData['analysisResult'];
  riskAssessment?: ApiSessionData['riskAssessment'];
  sandboxEligibility?: ApiSessionData['sandboxEligibility'];
}

export const RiskPreviewPanel: React.FC<RiskPreviewPanelProps> = ({
  analysisResult,
  riskAssessment,
  sandboxEligibility,
}) => {
  const hasAnalysis = Boolean(analysisResult && riskAssessment);
  const blockers = analysisResult?.blockers || [];
  const findings = analysisResult?.findings || [];
  const hasBlockers = blockers.length > 0;
  const hasFindings = findings.length > 0;

  const getRiskBadgeClass = () => {
    if (hasBlockers) return 'badge-error';
    const risk = riskAssessment?.overallRiskLevel;
    switch (risk) {
      case 'LOW':
        return 'badge-success';
      case 'MEDIUM':
        return 'badge-warning';
      case 'HIGH':
      case 'CRITICAL':
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div
      className="panel-elevated"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldWarning size={18} color="var(--accent)" weight="bold" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Risk Evaluation</h3>
        </div>
        <span
          className={`badge ${hasAnalysis ? getRiskBadgeClass() : 'badge-neutral'}`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className="status-indicator" />
          <span>
            {hasAnalysis
              ? hasBlockers
                ? 'BLOCKED'
                : `Risk: ${riskAssessment?.overallRiskLevel || 'ANALYZED'}`
              : 'Pending Analysis'}
          </span>
        </span>
      </div>

      {/* Content Area */}
      {!hasAnalysis ? (
        <div
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            backgroundColor: '#06070a',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ListMagnifyingGlass size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              No analysis yet
            </div>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                maxWidth: '44ch',
                margin: '0 auto',
                lineHeight: 1.5,
              }}
            >
              Enter a migration script and click Analyze Migration to evaluate lock impacts, data
              integrity risks, and sandbox rehearsal requirements.
            </p>
          </div>
        </div>
      ) : (
        /* Real Active Analysis Summary */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Metrics Overview Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>RISK SCORE</div>
              <div
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color:
                    hasBlockers || (riskAssessment?.overallScore ?? 0) > 50
                      ? 'var(--status-error)'
                      : (riskAssessment?.overallScore ?? 0) > 20
                        ? 'var(--status-warning)'
                        : 'var(--status-success)',
                  marginTop: '0.25rem',
                }}
              >
                {riskAssessment?.overallScore ?? 0} / 100
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>HIGHEST LOCK</div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: '0.25rem',
                }}
              >
                {riskAssessment?.lockAnalysis?.lockMode || 'NONE'}
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                SANDBOX REHEARSAL
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: sandboxEligibility?.requiresSandbox
                    ? 'var(--accent)'
                    : 'var(--status-success)',
                  marginTop: '0.25rem',
                }}
              >
                {sandboxEligibility?.requiresSandbox ? 'Required' : 'Optional'}
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>STATUS</div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: hasBlockers ? 'var(--status-error)' : 'var(--text-primary)',
                  marginTop: '0.25rem',
                }}
              >
                {hasBlockers
                  ? `${blockers.length} Blocker${blockers.length > 1 ? 's' : ''}`
                  : `${findings.length} findings`}
              </div>
            </div>
          </div>

          {/* Blocker Alert Box (Rendered whenever blockers exist) */}
          {hasBlockers && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--status-error)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                <WarningCircle size={16} />
                <span>
                  {blockers.length} Migration Blocker{blockers.length > 1 ? 's' : ''} Detected
                </span>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.25rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                }}
              >
                {blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Findings List (if any) */}
          {hasFindings ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ANALYSIS FINDINGS
              </div>
              {findings.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: 'var(--radius-card)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</span>
                    <span
                      className={`badge ${
                        f.severity === 'CRITICAL' || f.severity === 'HIGH'
                          ? 'badge-error'
                          : f.severity === 'MEDIUM'
                            ? 'badge-warning'
                            : 'badge-neutral'
                      }`}
                      style={{ fontSize: '0.625rem' }}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {f.explanation}
                  </div>
                  {f.recommendation && (
                    <div
                      style={{
                        color: 'var(--accent)',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        marginTop: '0.25rem',
                      }}
                    >
                      Recommendation: {f.recommendation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !hasBlockers ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-card)',
                color: 'var(--status-success)',
                fontSize: '0.8125rem',
              }}
            >
              <CheckCircle size={16} />
              <span>Zero blocking migration risks detected.</span>
            </div>
          ) : null}
        </div>
      )}

      {/* 5 Risk Dimensions Framework */}
      <div>
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '0.5rem',
          }}
        >
          ANALYSIS DIMENSIONS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {[
            { key: 'LOCKING' as RiskCategory, label: 'LOCKING', desc: 'Table locks & concurrency' },
            {
              key: 'DATA_INTEGRITY' as RiskCategory,
              label: 'DATA_INTEGRITY',
              desc: 'Destructive DDL checks',
            },
            {
              key: 'PERFORMANCE' as RiskCategory,
              label: 'PERFORMANCE',
              desc: 'Sequential scan risks',
            },
            {
              key: 'ROLLBACK' as RiskCategory,
              label: 'ROLLBACK',
              desc: 'Transaction reversibility',
            },
            {
              key: 'COMPATIBILITY' as RiskCategory,
              label: 'COMPATIBILITY',
              desc: 'PostgreSQL catalog rules',
            },
          ].map((dim) => {
            const categoryAssessment = riskAssessment?.categoryAssessments?.[dim.key];
            const score = categoryAssessment?.score;
            const hasScore = score !== undefined;

            return (
              <div
                key={dim.key}
                style={{
                  padding: '0.5rem 0.625rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-badge)',
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{dim.label}</span>
                  {hasScore && (
                    <span
                      style={{
                        color:
                          score > 50
                            ? 'var(--status-error)'
                            : score > 20
                              ? 'var(--status-warning)'
                              : 'var(--status-success)',
                        fontWeight: 600,
                      }}
                    >
                      {score}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.125rem',
                  }}
                >
                  {dim.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
