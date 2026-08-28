import React, { useState } from 'react';
import {
  ShieldWarning,
  ListMagnifyingGlass,
  WarningCircle,
  Sparkle,
  Copy,
  Check,
  ArrowsCounterClockwise,
  Cpu,
  CaretUp,
  CaretDown,
  Lightning,
} from '@phosphor-icons/react';
import {
  type RiskCategory,
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
  getNextFallbackModel,
} from '@orvexa/shared';
import {
  MigrationApiClient,
  type ApiSessionData,
  type ExecutiveBriefData,
} from '../../services/migration-api.service.js';
import { GeminiModelSelector } from './GeminiModelSelector.js';

interface RiskPreviewPanelProps {
  sessionId?: string;
  analysisResult?: ApiSessionData['analysisResult'];
  riskAssessment?: ApiSessionData['riskAssessment'];
  sandboxEligibility?: ApiSessionData['sandboxEligibility'];
}

export const RiskPreviewPanel: React.FC<RiskPreviewPanelProps> = ({
  sessionId,
  analysisResult,
  riskAssessment,
  sandboxEligibility,
}) => {
  const [brief, setBrief] = useState<ExecutiveBriefData | null>(null);
  const [briefSessionId, setBriefSessionId] = useState<string | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);
  const [isBriefExpanded, setIsBriefExpanded] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orvexa_selected_gemini_model') || DEFAULT_GEMINI_MODEL;
    }
    return DEFAULT_GEMINI_MODEL;
  });
  const [quotaError, setQuotaError] = useState<{
    isExceeded: boolean;
    failedModel: string;
    suggestedModel: string;
    message: string;
  } | null>(null);

  const activeSessionIdRef = React.useRef(sessionId);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('orvexa_selected_gemini_model', modelId);
    }
    setQuotaError(null);
    setBriefError(null);
  };

  // Finding 3: Reset brief state and cancel any in-flight request when switching migration sessions
  React.useEffect(() => {
    activeSessionIdRef.current = sessionId;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setBrief(null);
    setBriefSessionId(null);
    setIsGeneratingBrief(false);
    setBriefError(null);
    setQuotaError(null);
    setCopiedBrief(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [sessionId]);

  const hasAnalysis = Boolean(analysisResult && riskAssessment);
  const blockers = analysisResult?.blockers || [];
  const findings = analysisResult?.findings || [];
  const hasBlockers = blockers.length > 0;
  const hasFindings = findings.length > 0;

  const getRiskBadgeClass = () => {
    if (hasBlockers) return 'badge-red';
    const risk = riskAssessment?.overallRiskLevel;
    switch (risk) {
      case 'LOW':
        return 'badge-green';
      case 'MEDIUM':
        return 'badge-amber';
      case 'HIGH':
      case 'CRITICAL':
        return 'badge-red';
      default:
        return 'badge-neutral';
    }
  };

  const handleGenerateBrief = async (overrideModel?: string) => {
    if (!sessionId || isGeneratingBrief) return;
    const requestSessionId = sessionId;
    const modelToUse = typeof overrideModel === 'string' ? overrideModel : selectedModel;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGeneratingBrief(true);
    setBriefError(null);
    setQuotaError(null);
    try {
      const result = await MigrationApiClient.generateExecutiveBrief(
        requestSessionId,
        modelToUse,
        controller.signal
      );
      // Guard against stale response if user switched session while request was in flight
      if (activeSessionIdRef.current === requestSessionId && !controller.signal.aborted) {
        if (result.success && result.data) {
          setBrief(result.data);
          setBriefSessionId(requestSessionId);
          setQuotaError(null);
        } else {
          if (result.isQuotaExceeded || result.errorKind === 'QUOTA_EXCEEDED') {
            const currentInfo = getGeminiModel(modelToUse);
            const fallbackInfo = getNextFallbackModel(currentInfo.id);
            setQuotaError({
              isExceeded: true,
              failedModel: currentInfo.label,
              suggestedModel: fallbackInfo.id,
              message:
                result.error || `Your Gemini API quota for ${currentInfo.label} has been exceeded.`,
            });
          } else {
            setBriefError(
              result.error || 'Failed to generate executive brief from TrueForge agent.'
            );
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      if (activeSessionIdRef.current === requestSessionId && !controller.signal.aborted) {
        setBriefError('Failed to generate executive brief from TrueForge agent.');
      }
    } finally {
      if (activeSessionIdRef.current === requestSessionId) {
        setIsGeneratingBrief(false);
      }
    }
  };

  const handleCopyBrief = async () => {
    if (!brief?.summary) return;
    try {
      await navigator.clipboard.writeText(brief.summary);
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2000);
    } catch {
      // fallback
    }
  };

  // Helper to remove any emojis from text
  const stripEmojis = (str: string) => {
    return str
      .replace(
        /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gu,
        ''
      )
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/[\u2600-\u26FF\u2700-\u27BF]/gu, '')
      .trim();
  };

  // Lightweight safe markdown line-by-line renderer without emojis
  const renderMarkdownBrief = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (keyPrefix: string) => {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={`${keyPrefix}-list`}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
    };

    const formatInline = (text: string): React.ReactNode => {
      const deEmojified = stripEmojis(text);
      const parts = deEmojified.split(/(\*\*.*?\*\*|`.*?`)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{stripEmojis(part.slice(2, -2))}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{stripEmojis(part.slice(1, -1))}</code>;
        }
        return part;
      });
    };

    lines.forEach((rawLine, idx) => {
      const line = stripEmojis(rawLine.trim());
      if (!line) {
        flushList(`blank-${idx}`);
        return;
      }

      if (line.startsWith('# ')) {
        flushList(`h1-${idx}`);
        elements.push(<h1 key={`h1-${idx}`}>{formatInline(line.slice(2))}</h1>);
      } else if (line.startsWith('## ')) {
        flushList(`h2-${idx}`);
        elements.push(<h2 key={`h2-${idx}`}>{formatInline(line.slice(3))}</h2>);
      } else if (line.startsWith('### ')) {
        flushList(`h3-${idx}`);
        elements.push(<h3 key={`h3-${idx}`}>{formatInline(line.slice(4))}</h3>);
      } else if (line.startsWith('* ') || line.startsWith('- ') || /^\d+\.\s+/.test(line)) {
        inList = true;
        const cleaned = line.replace(/^(\*|-|\d+\.)\s+/, '');
        listItems.push(<li key={`li-${idx}`}>{formatInline(cleaned)}</li>);
      } else if (line === '---') {
        flushList(`hr-${idx}`);
        elements.push(
          <hr
            key={`hr-${idx}`}
            style={{
              border: 'none',
              borderTop: '1px solid var(--border-subtle)',
              margin: '0.625rem 0',
            }}
          />
        );
      } else {
        flushList(`p-${idx}`);
        elements.push(
          <p key={`p-${idx}`} style={{ margin: 0 }}>
            {formatInline(line)}
          </p>
        );
      }
    });

    flushList('end');
    return elements;
  };

  return (
    <div className="c-card">
      {/* Header */}
      <div className="c-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <ShieldWarning size={16} color="var(--accent)" weight="bold" />
          </div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Risk Evaluation
          </h3>
        </div>
        <span
          className={`badge ${hasAnalysis ? getRiskBadgeClass() : 'badge-neutral'}`}
          style={{ fontSize: '0.6875rem' }}
        >
          <span className={`dot ${hasAnalysis ? 'dot-pulse' : ''}`} />
          <span>
            {hasAnalysis
              ? hasBlockers
                ? 'BLOCKED'
                : `RISK: ${riskAssessment?.overallRiskLevel || 'ANALYZED'}`
              : 'PENDING ANALYSIS'}
          </span>
        </span>
      </div>

      <div
        className="c-card-body"
        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        {/* Content Area */}
        {!hasAnalysis ? (
          <div className="c-empty">
            <div className="c-empty-icon">
              <ListMagnifyingGlass size={22} color="var(--text-muted)" />
            </div>
            <div className="c-empty-title">Deterministic AST Engine Ready</div>
            <p className="c-empty-sub">
              Enter or select a migration script above, then trigger analysis to calculate lock
              modes, row scan hazards, and sandbox rehearsal requirements.
            </p>
          </div>
        ) : (
          /* Active Analysis Summary */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Metrics Overview Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.625rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {/* Risk Score */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Risk Score
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {riskAssessment?.overallScore ?? 0}
                  <span
                    style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}
                  >
                    /100
                  </span>
                </div>
              </div>

              {/* Peak Lock Mode */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Peak Lock Mode
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: '0.35rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={riskAssessment?.lockAnalysis?.lockMode || 'ROW EXCLUSIVE'}
                >
                  {riskAssessment?.lockAnalysis?.lockMode || 'ROW EXCLUSIVE'}
                </div>
              </div>

              {/* Sandbox Requirement */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Sandbox Rehearsal
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: sandboxEligibility?.requiresSandbox ? 'var(--accent)' : 'var(--green)',
                    marginTop: '0.35rem',
                  }}
                >
                  {sandboxEligibility?.requiresSandbox ? 'Mandatory' : 'Optional'}
                </div>
              </div>

              {/* Blockers / Warnings Count */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Safety Barrier
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: hasBlockers ? 'var(--red)' : 'var(--green)',
                    marginTop: '0.35rem',
                  }}
                >
                  {hasBlockers ? `${blockers.length} Hard Blocker(s)` : 'Clear for Rehearsal'}
                </div>
              </div>
            </div>

            {/* Blockers Alert Banner */}
            {hasBlockers && (
              <div
                style={{
                  padding: '0.875rem 1rem',
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red-border)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                }}
              >
                <WarningCircle
                  size={18}
                  color="var(--red)"
                  weight="bold"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--red)' }}>
                    Dangerous Statements Detected
                  </div>
                  <ul
                    style={{
                      margin: '0.25rem 0 0 0',
                      paddingLeft: '1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* AST Analysis Findings List */}
            {hasFindings && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Detected Hazards & Structural Findings ({findings.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {findings.map((f, idx) => (
                    <div
                      key={f.id || idx}
                      style={{
                        padding: '0.625rem 0.875rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.625rem',
                      }}
                    >
                      <span
                        className={`badge ${
                          f.severity === 'CRITICAL' || f.severity === 'HIGH'
                            ? 'badge-red'
                            : f.severity === 'MEDIUM'
                              ? 'badge-amber'
                              : 'badge-neutral'
                        }`}
                        style={{
                          fontSize: '0.5625rem',
                          padding: '0.1rem 0.4rem',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {f.severity}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {f.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.15rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {f.explanation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Dimensions Grid */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginTop: '0.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Analysis Dimensions
              </div>
              <div className="dim-grid">
                {[
                  {
                    key: 'LOCKING' as RiskCategory,
                    label: 'Locking',
                    desc: 'Table locks & concurrency',
                  },
                  {
                    key: 'DATA_INTEGRITY' as RiskCategory,
                    label: 'Data Integrity',
                    desc: 'Destructive DDL checks',
                  },
                  {
                    key: 'PERFORMANCE' as RiskCategory,
                    label: 'Performance',
                    desc: 'Sequential scan risks',
                  },
                  {
                    key: 'ROLLBACK' as RiskCategory,
                    label: 'Rollback',
                    desc: 'Transaction reversibility',
                  },
                  {
                    key: 'COMPATIBILITY' as RiskCategory,
                    label: 'Compatibility',
                    desc: 'PostgreSQL catalog rules',
                  },
                ].map((dim) => {
                  const categoryAssessment = riskAssessment?.categoryAssessments?.[dim.key];
                  const score = categoryAssessment?.score;
                  const hasScore = score !== undefined;

                  const scoreClass =
                    !hasScore || score === 0
                      ? 'badge-green'
                      : score > 50
                        ? 'badge-red'
                        : score > 20
                          ? 'badge-amber'
                          : 'badge-green';

                  return (
                    <div key={dim.key} className="dim-card">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.25rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <span className="dim-title">{dim.label}</span>
                        {hasScore && (
                          <span
                            className={`badge ${scoreClass}`}
                            style={{ fontSize: '0.5625rem', padding: '0.05rem 0.35rem' }}
                          >
                            {score}
                          </span>
                        )}
                      </div>
                      <div className="dim-sub">{dim.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                TRUEFORGE AGENT HARNESS + GEMINI EXECUTIVE BRIEF
               ═══════════════════════════════════════════════════ */}
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
              }}
            >
              {!brief || briefSessionId !== sessionId ? (
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'var(--accent-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Sparkle size={16} color="var(--accent)" weight="fill" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          AI Executive Release Brief
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          Translate technical AST lock hazards into non-technical stakeholder
                          release notes
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>
                        <Cpu size={10} style={{ marginRight: '2px' }} />
                        TrueForge
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>
                        {getGeminiModel(selectedModel).label}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>
                        Orvexa MCP
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>
                        Daytona Sandbox
                      </span>
                    </div>
                  </div>

                  {quotaError && (
                    <div
                      style={{
                        padding: '0.875rem 1rem',
                        background: '#fffbeb',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.625rem',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <WarningCircle size={18} color="var(--amber)" weight="fill" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e' }}>
                          Gemini Quota Exceeded on {quotaError.failedModel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.4 }}>
                        {quotaError.message} You can instantly switch to an alternate model below:
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectModel(quotaError.suggestedModel);
                            handleGenerateBrief(quotaError.suggestedModel);
                          }}
                          className="btn btn-accent"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#d97706',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <Lightning size={13} weight="fill" />
                          Switch to {getGeminiModel(quotaError.suggestedModel).label} & Retry
                        </button>
                        <GeminiModelSelector
                          selectedModel={selectedModel}
                          onSelectModel={(newModel) => {
                            handleSelectModel(newModel);
                            handleGenerateBrief(newModel);
                          }}
                          compact
                        />
                      </div>
                    </div>
                  )}

                  {briefError && !quotaError && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--red)',
                        background: 'var(--red-bg)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <WarningCircle size={14} color="var(--red)" weight="fill" />
                      <span>{briefError}</span>
                    </div>
                  )}

                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}
                  >
                    <button
                      id="generate-executive-brief-btn"
                      type="button"
                      onClick={() => handleGenerateBrief()}
                      disabled={isGeneratingBrief || !sessionId}
                      className="btn btn-outline"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent-text)',
                        background: isGeneratingBrief ? 'var(--bg-surface)' : 'var(--accent-light)',
                      }}
                    >
                      {isGeneratingBrief ? (
                        <>
                          <ArrowsCounterClockwise size={14} className="spin" />
                          <span>TrueForge Agent executing with MCP & Daytona Sandbox...</span>
                        </>
                      ) : (
                        <>
                          <Sparkle size={14} weight="fill" />
                          <span>
                            Generate Executive Brief ({getGeminiModel(selectedModel).label})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Generated Executive Release Brief Container */
                <div className="brief-container">
                  <div className="brief-header">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Sparkle size={16} color="var(--accent)" weight="fill" />
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        Executive Release Brief
                      </span>
                      <span className="badge badge-green" style={{ fontSize: '0.5625rem' }}>
                        ✓ TrueForge Verified
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.5625rem' }}>
                        MCP & Daytona Cloud
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {brief.durationMs ? `${brief.durationMs}ms` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyBrief}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: copiedBrief ? 'var(--green)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                        title="Copy Markdown to Clipboard"
                      >
                        {copiedBrief ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                        <span>{copiedBrief ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateBrief()}
                        disabled={isGeneratingBrief}
                        style={{
                          background: isGeneratingBrief
                            ? 'var(--accent-light)'
                            : 'var(--bg-surface)',
                          border: isGeneratingBrief
                            ? '1px solid var(--accent)'
                            : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: isGeneratingBrief ? 'var(--accent-text)' : 'var(--text-secondary)',
                          cursor: isGeneratingBrief ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: isGeneratingBrief ? 600 : 500,
                        }}
                        title={
                          isGeneratingBrief
                            ? 'TrueForge Agent dispatching to Gemini...'
                            : 'Regenerate Executive Brief'
                        }
                      >
                        <ArrowsCounterClockwise
                          size={12}
                          className={isGeneratingBrief ? 'spin' : ''}
                        />
                        <span>{isGeneratingBrief ? 'Regenerating...' : 'Regenerate'}</span>
                      </button>
                      <button
                        id="toggle-brief-expand-btn"
                        type="button"
                        onClick={() => setIsBriefExpanded(!isBriefExpanded)}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 120ms ease',
                        }}
                        title={
                          isBriefExpanded ? 'Collapse Executive Brief' : 'Expand Executive Brief'
                        }
                      >
                        {isBriefExpanded ? (
                          <>
                            <CaretUp size={12} weight="bold" />
                            <span>Collapse</span>
                          </>
                        ) : (
                          <>
                            <CaretDown size={12} weight="bold" />
                            <span>Expand</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isGeneratingBrief && (
                    <div
                      style={{
                        padding: '0.625rem 1rem',
                        background: 'var(--accent-light)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-text)',
                        fontWeight: 600,
                      }}
                    >
                      <ArrowsCounterClockwise size={14} className="spin" />
                      <span>TrueForge Agent dispatching to Gemini...</span>
                    </div>
                  )}

                  {isBriefExpanded ? (
                    <div
                      className="brief-content"
                      style={{
                        opacity: isGeneratingBrief ? 0.45 : 1,
                        pointerEvents: isGeneratingBrief ? 'none' : 'auto',
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      {renderMarkdownBrief(brief.summary)}
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsBriefExpanded(true)}
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-surface)',
                        borderTop: '1px solid var(--border-faint)',
                      }}
                      title="Click to expand full brief"
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Executive brief collapsed · {brief.model} (click to expand)
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--accent-text)',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        Expand brief ▾
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
