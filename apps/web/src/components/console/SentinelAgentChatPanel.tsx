import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkle,
  PaperPlaneRight,
  ArrowsCounterClockwise,
  Check,
  Copy,
  Lightning,
  Trash,
} from '@phosphor-icons/react';
import {
  MigrationApiClient,
  type AgentChatResponseData,
} from '../../services/migration-api.service.js';
import {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
  getNextFallbackModel,
} from '@orvexa/shared';
import { GeminiModelSelector } from './GeminiModelSelector.js';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  suggestedSql?: string;
  timestamp: string;
  durationMs?: number;
  isQuotaAlert?: boolean;
  failedModel?: string;
  suggestedModel?: string;
  retryText?: string;
}

export interface OrvexaPilotChatPanelProps {
  sessionId?: string;
  currentSql: string;
  onApplySql: (newSql: string) => void;
  onRunRehearsal?: () => void;
  onTriggerAnalysis?: () => void;
  isRehearsing?: boolean;
}

export type SentinelAgentChatPanelProps = OrvexaPilotChatPanelProps;

const QUICK_PROMPTS = [
  {
    label: 'Rewrite for Zero-Downtime',
    prompt: 'Can you rewrite this ALTER TABLE to avoid an ACCESS EXCLUSIVE table lock?',
  },
  {
    label: 'Why is this Risky?',
    prompt:
      'Why is this migration marked as High Risk? Explain the exact lock hazards and PostgreSQL catalog impact.',
  },
  {
    label: 'Rehearsal & Data Safety',
    prompt: 'Rehearse this migration and tell me if data was lost or if tables were rewritten.',
  },
  {
    label: 'Lock Hierarchy',
    prompt:
      'What PostgreSQL locks does this migration acquire and does it block active SELECT queries?',
  },
];

export const OrvexaPilotChatPanel: React.FC<OrvexaPilotChatPanelProps> = ({
  sessionId,
  currentSql,
  onApplySql,
  onRunRehearsal,
  onTriggerAnalysis,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: '**Hello! I am Orvexa Pilot — your database migration copilot.**\n\nI monitor your migration statements using real-time AST parsing, PostgreSQL catalog inspection via **Orvexa MCP**, and isolated **Daytona Cloud Sandboxes**.\n\nAsk me anything about lock hazards, request a zero-downtime rewrite, or ask me to verify rehearsal safety.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedSqlId, setAppliedSqlId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orvexa_selected_gemini_model') || DEFAULT_GEMINI_MODEL;
    }
    return DEFAULT_GEMINI_MODEL;
  });

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('orvexa_selected_gemini_model', modelId);
    }
  };

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string, overrideModel?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const modelToUse = typeof overrideModel === 'string' ? overrideModel : selectedModel;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // If the user's prompt mentions "rehearse", trigger the rehearsal action too if available
      const lower = text.toLowerCase();
      if (
        (lower.includes('rehearse') ||
          lower.includes('run rehearsal') ||
          lower.includes('sandbox')) &&
        onRunRehearsal
      ) {
        onRunRehearsal();
      }

      const res = await MigrationApiClient.sendAgentChatMessage(
        sessionId,
        text,
        currentSql,
        modelToUse
      );

      if (res.success && res.data) {
        const data: AgentChatResponseData = res.data;
        const agentMsg: ChatMessage = {
          id: `agent_${Date.now()}`,
          sender: 'agent',
          text: data.reply,
          suggestedSql: data.suggestedSql,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          durationMs: data.durationMs,
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        if (res.isQuotaExceeded || res.errorKind === 'QUOTA_EXCEEDED') {
          const currentInfo = getGeminiModel(modelToUse);
          const fallbackInfo = getNextFallbackModel(currentInfo.id);
          const quotaMsg: ChatMessage = {
            id: `quota_${Date.now()}`,
            sender: 'agent',
            text: `**Gemini API Quota Exceeded on ${currentInfo.label}**\n\nYour API quota or rate limit for **${currentInfo.label}** has been exceeded. Switch models below to continue.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isQuotaAlert: true,
            failedModel: currentInfo.id,
            suggestedModel: fallbackInfo.id,
            retryText: text,
          };
          setMessages((prev) => [...prev, quotaMsg]);
        } else {
          const errorMsg: ChatMessage = {
            id: `err_${Date.now()}`,
            sender: 'agent',
            text: `**Agent Error:** ${res.error || 'Unable to communicate with TrueForge Agent Runtime.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'agent',
        text: `**Network Error:** ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyRewrite = (id: string, sqlToApply: string) => {
    onApplySql(sqlToApply);
    setAppliedSqlId(id);
    if (onTriggerAnalysis) {
      setTimeout(() => {
        onTriggerAnalysis();
      }, 100);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'agent',
        text: 'Chat history cleared. How can I assist with your PostgreSQL migration?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Helper to format inline code, bold, italic
  const formatInline = (text: string): React.ReactNode => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent)',
              display: 'inline-block',
              margin: '0 0.15rem',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={i} style={{ fontStyle: 'italic' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Full rich markdown renderer for chat messages
  const renderChatMessageMarkdown = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];
    let inTable = false;
    let tableHeader: string[] = [];
    let tableRows: string[][] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: string) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul
            key={`list-${key}`}
            style={{
              margin: '0.35rem 0',
              paddingLeft: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: string) => {
      if (inTable && (tableHeader.length > 0 || tableRows.length > 0)) {
        elements.push(
          <div
            key={`table-wrap-${key}`}
            style={{
              overflowX: 'auto',
              margin: '0.625rem 0',
              borderRadius: '8px',
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-elevated)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.75rem',
                textAlign: 'left',
              }}
            >
              {tableHeader.length > 0 && (
                <thead>
                  <tr
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderBottom: '1px solid var(--border-dim)',
                    }}
                  >
                    {tableHeader.map((th, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '0.45rem 0.65rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                        }}
                      >
                        {formatInline(th)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom:
                        rIdx === tableRows.length - 1 ? 'none' : '1px solid var(--border-faint)',
                    }}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '0.4rem 0.65rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeader = [];
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Fenced code block toggles
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          flushList(`pre-code-${i}`);
          flushTable(`pre-code-${i}`);
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim() || 'sql';
          codeLines = [];
        } else {
          inCodeBlock = false;
          const codeContent = codeLines.join('\n');
          const blockId = `code-block-${i}`;
          elements.push(
            <div
              key={blockId}
              style={{
                margin: '0.625rem 0',
                background: '#111827',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.3rem 0.65rem',
                  background: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #374151',
                }}
              >
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#9ca3af',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {codeLanguage}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(blockId, codeContent)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedId === blockId ? '#10b981' : '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.625rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {copiedId === blockId ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedId === blockId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: '#34d399',
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
                <code>{codeContent}</code>
              </pre>
            </div>
          );
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Markdown Tables (| cell | cell |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushList(`pre-table-${i}`);
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Check if this is separator row (|:---|:---|)
        const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));
        if (isSeparator) {
          inTable = true;
          continue;
        }

        if (!inTable && tableHeader.length === 0) {
          tableHeader = cells;
          inTable = true;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable(`end-table-${i}`);
      }

      if (!trimmed) {
        flushList(`blank-${i}`);
        continue;
      }

      // Headings
      if (trimmed.startsWith('#### ')) {
        flushList(`h4-${i}`);
        elements.push(
          <div
            key={`h4-${i}`}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              margin: '0.5rem 0 0.2rem 0',
              color: 'var(--text-primary)',
            }}
          >
            {formatInline(trimmed.slice(5))}
          </div>
        );
      } else if (trimmed.startsWith('### ')) {
        flushList(`h3-${i}`);
        elements.push(
          <div
            key={`h3-${i}`}
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              margin: '0.625rem 0 0.25rem 0',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border-faint)',
              paddingBottom: '0.2rem',
            }}
          >
            {formatInline(trimmed.slice(4))}
          </div>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList(`h2-${i}`);
        elements.push(
          <div
            key={`h2-${i}`}
            style={{
              fontSize: '0.875rem',
              fontWeight: 800,
              margin: '0.75rem 0 0.35rem 0',
              color: 'var(--text-primary)',
            }}
          >
            {formatInline(trimmed.slice(3))}
          </div>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList(`h1-${i}`);
        elements.push(
          <div
            key={`h1-${i}`}
            style={{
              fontSize: '0.9375rem',
              fontWeight: 800,
              margin: '0.875rem 0 0.35rem 0',
              color: 'var(--text-primary)',
            }}
          >
            {formatInline(trimmed.slice(2))}
          </div>
        );
      } else if (trimmed === '---' || trimmed === '***') {
        flushList(`hr-${i}`);
        elements.push(
          <hr
            key={`hr-${i}`}
            style={{
              border: 'none',
              borderTop: '1px solid var(--border-subtle)',
              margin: '0.625rem 0',
            }}
          />
        );
      } else if (
        trimmed.startsWith('- ') ||
        trimmed.startsWith('* ') ||
        /^\d+\.\s+/.test(trimmed)
      ) {
        inList = true;
        const cleaned = trimmed.replace(/^(\*|-|\d+\.)\s+/, '');
        listItems.push(
          <li key={`li-${i}`} style={{ color: 'var(--text-primary)' }}>
            {formatInline(cleaned)}
          </li>
        );
      } else {
        flushList(`p-${i}`);
        elements.push(
          <div key={`p-${i}`} style={{ margin: '0.2rem 0', lineHeight: 1.6 }}>
            {formatInline(trimmed)}
          </div>
        );
      }
    }

    flushList('final');
    flushTable('final');

    return elements;
  };

  return (
    <div
      className="c-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '480px',
        maxHeight: '680px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            <Sparkle size={16} weight="fill" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              Orvexa Pilot
            </div>
            <div
              style={{
                fontSize: '0.625rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              TrueForge • Gemini • MCP • Daytona
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleClearHistory}
            title="Clear Chat"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--bg-surface)',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  maxWidth: '88%',
                  background: isUser ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isUser ? '#ffffff' : 'var(--text-primary)',
                  border: isUser ? 'none' : '1px solid var(--border-dim)',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  padding: '0.875rem 1rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  boxShadow: 'var(--shadow-xs)',
                  wordBreak: 'break-word',
                }}
              >
                {/* Message Body */}
                <div style={{ color: isUser ? '#ffffff' : 'var(--text-primary)' }}>
                  {renderChatMessageMarkdown(msg.text)}
                </div>

                {/* Suggested SQL Rewrite Card */}
                {msg.suggestedSql && (
                  <div
                    style={{
                      marginTop: '0.875rem',
                      background: '#111827',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#9ca3af',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Lightning size={11} weight="fill" color="#f59e0b" />
                        <span>Recommended Zero-Downtime SQL</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.suggestedSql!)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === msg.id ? '#10b981' : '#9ca3af',
                          cursor: 'pointer',
                          fontSize: '0.625rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div
                      style={{
                        padding: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: '#34d399',
                        overflowX: 'auto',
                        whiteSpace: 'pre',
                      }}
                    >
                      {msg.suggestedSql}
                    </div>

                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: '#1f2937',
                        borderTop: '1px solid #374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyRewrite(msg.id, msg.suggestedSql!)}
                        className="btn btn-accent"
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: appliedSqlId === msg.id ? 'var(--green)' : 'var(--accent)',
                        }}
                      >
                        {appliedSqlId === msg.id ? (
                          <>
                            <Check size={12} weight="bold" />
                            <span>Applied & Analyzed!</span>
                          </>
                        ) : (
                          <>
                            <Lightning size={12} weight="fill" />
                            <span>Apply Safe SQL to Editor & Re-Analyze</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Quota Exceeded Interactive Action Box */}
                {msg.isQuotaAlert && msg.suggestedModel && msg.retryText && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.625rem 0.75rem',
                      background: '#fffbeb',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>
                      Switch to an alternate Gemini model to continue without quota errors:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectModel(msg.suggestedModel!);
                          handleSendMessage(msg.retryText, msg.suggestedModel!);
                        }}
                        className="btn btn-accent"
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          background: '#d97706',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Lightning size={12} weight="fill" />
                        Switch to {getGeminiModel(msg.suggestedModel).label} & Retry
                      </button>
                      <GeminiModelSelector
                        selectedModel={selectedModel}
                        onSelectModel={(newModel) => {
                          handleSelectModel(newModel);
                          handleSendMessage(msg.retryText, newModel);
                        }}
                        compact
                      />
                    </div>
                  </div>
                )}
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: '0.625rem',
                    color: isUser ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isUser ? 'flex-end' : 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  {!isUser && msg.durationMs && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <Lightning size={10} weight="fill" color="var(--text-muted)" />
                      {msg.durationMs}ms
                    </span>
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              borderRadius: '14px',
              maxWidth: '360px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowsCounterClockwise size={16} className="spin" color="var(--accent)" />
            <span>Orvexa Pilot reasoning with TrueForge & Gemini...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div
        className="quick-prompts-bar"
        style={{
          padding: '0.625rem 1rem',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-faint)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flexShrink: 0,
        }}
      >
        {QUICK_PROMPTS.map((qp, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(qp.prompt)}
            disabled={isLoading}
            style={{
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Orvexa Pilot (e.g. 'Why is this risky?', 'Rewrite for zero-downtime')..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '0.6rem 0.875rem',
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="btn btn-accent"
          style={{
            padding: '0.6rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            opacity: !inputValue.trim() || isLoading ? 0.5 : 1,
            cursor: !inputValue.trim() || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <span>Send</span>
          <PaperPlaneRight size={14} weight="bold" />
        </button>
      </form>
    </div>
  );
};

export { OrvexaPilotChatPanel as SentinelAgentChatPanel };
