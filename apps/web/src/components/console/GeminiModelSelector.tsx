import React, { useState, useRef, useEffect } from 'react';
import { Sparkle, CaretDown, Check } from '@phosphor-icons/react';
import { GEMINI_MODELS, getGeminiModel, type GeminiModelInfo } from '@orvexa/shared';

interface GeminiModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  compact?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export const GeminiModelSelector: React.FC<GeminiModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
  compact = false,
  disabled = false,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeModel = getGeminiModel(selectedModel);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const tiers: Array<GeminiModelInfo['tier']> = [
    'Gemini 3 Series',
    'Gemini 2.5 Series',
    'Legacy & Fast Tier',
  ];

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 99999 : 1,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="model-selector-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: compact ? '0.25rem 0.5rem' : '0.35rem 0.65rem',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '999px',
          fontSize: compact ? '0.6875rem' : '0.75rem',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}
        title={`Active Model: ${activeModel.label} (${activeModel.description})`}
      >
        <Sparkle size={compact ? 11 : 13} color="var(--accent)" weight="fill" />
        <span style={{ fontWeight: 700 }}>{activeModel.label}</span>
        <CaretDown
          size={10}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            width: '295px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '400px',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.06)',
            padding: '0.5rem',
            zIndex: 9999,
            animation: 'fadeIn 120ms ease-out',
          }}
        >
          <div
            style={{
              padding: '0.4rem 0.6rem 0.5rem',
              borderBottom: '1px solid var(--border-faint)',
              marginBottom: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              Select Gemini Model
            </span>
            <span
              className="badge badge-blue"
              style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem' }}
            >
              Quota Switcher
            </span>
          </div>

          {tiers.map((tier) => {
            const modelsInTier = GEMINI_MODELS.filter((m) => m.tier === tier);
            return (
              <div key={tier} style={{ marginBottom: '0.5rem' }}>
                <div
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-subtle)',
                    borderRadius: '6px',
                    margin: '0.2rem 0',
                  }}
                >
                  {tier}
                </div>

                {modelsInTier.map((model) => {
                  const isSelected = model.id === activeModel.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(model.id);
                        setIsOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.6rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                        border: isSelected
                          ? '1px solid var(--accent-border)'
                          : '1px solid transparent',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        marginBottom: '2px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-elevated)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                          }}
                        >
                          <span>{model.label}</span>
                          {model.isDefault && (
                            <span
                              style={{
                                fontSize: '0.5625rem',
                                padding: '0.05rem 0.35rem',
                                background: 'rgba(5, 150, 105, 0.1)',
                                color: 'var(--green)',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-secondary)',
                            marginTop: '2px',
                            lineHeight: 1.3,
                          }}
                        >
                          {model.description}
                        </div>
                      </div>

                      {isSelected && (
                        <Check
                          size={14}
                          color="var(--accent)"
                          weight="bold"
                          style={{ flexShrink: 0, marginTop: '2px' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
