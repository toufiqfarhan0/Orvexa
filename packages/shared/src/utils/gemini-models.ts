/**
 * Google Gemini Model Catalog and Quota Fallback Registry
 */

export interface GeminiModelInfo {
  id: string; // e.g. 'gemini-3.6-flash'
  fullName: string; // e.g. 'google-gemini/gemini-3.6-flash'
  label: string; // e.g. 'Gemini 3.6 Flash'
  tier: 'Gemini 3 Series' | 'Gemini 2.5 Series' | 'Legacy & Fast Tier';
  description: string;
  isDefault?: boolean;
  recommendedFallback: string; // Next model to switch to if quota is exceeded
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  // ── Gemini 3 Series (Latest Generation) ──
  {
    id: 'gemini-3.1-pro-preview',
    fullName: 'google-gemini/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro (Preview)',
    tier: 'Gemini 3 Series',
    description: 'Most advanced reasoning, complex problem solving & agent workflows',
    recommendedFallback: 'gemini-3-flash-preview',
  },
  {
    id: 'gemini-3-flash-preview',
    fullName: 'google-gemini/gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
    tier: 'Gemini 3 Series',
    description: 'Frontier-class intelligence & speed for high throughput',
    recommendedFallback: 'gemini-3.7-flash',
  },
  {
    id: 'gemini-3.7-flash',
    fullName: 'google-gemini/gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    tier: 'Gemini 3 Series',
    description: 'Tuned for complex multi-step reasoning and reliable code generation',
    recommendedFallback: 'gemini-3.6-flash',
  },
  {
    id: 'gemini-3.6-flash',
    fullName: 'google-gemini/gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    tier: 'Gemini 3 Series',
    description: 'High-speed synthesis and production release brief generation',
    isDefault: true,
    recommendedFallback: 'gemini-3.5-flash',
  },
  {
    id: 'gemini-3.5-flash',
    fullName: 'google-gemini/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    tier: 'Gemini 3 Series',
    description: 'Near-Pro level coding & parallel execution at Flash speed',
    recommendedFallback: 'gemini-3.5-flash-lite',
  },
  {
    id: 'gemini-3.5-flash-lite',
    fullName: 'google-gemini/gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    tier: 'Gemini 3 Series',
    description: 'Lightweight, budget-friendly for high-volume execution',
    recommendedFallback: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-3.1-flash-lite',
    fullName: 'google-gemini/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    tier: 'Gemini 3 Series',
    description: 'Low-latency and cost-sensitive tasks',
    recommendedFallback: 'gemini-2.5-flash',
  },

  // ── Gemini 2.5 Series ──
  {
    id: 'gemini-2.5-pro',
    fullName: 'google-gemini/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tier: 'Gemini 2.5 Series',
    description: 'Adaptive thinking and 1M token context window for complex logic',
    recommendedFallback: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-2.5-flash',
    fullName: 'google-gemini/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tier: 'Gemini 2.5 Series',
    description: 'Lightning-fast model with controllable thinking budgets',
    recommendedFallback: 'gemini-2.5-flash-lite',
  },
  {
    id: 'gemini-2.5-flash-lite',
    fullName: 'google-gemini/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    tier: 'Gemini 2.5 Series',
    description: 'Massive scale and high throughput with core multimodal understanding',
    recommendedFallback: 'gemini-2.0-flash',
  },

  // ── Legacy & Fast Tier ──
  {
    id: 'gemini-2.0-flash',
    fullName: 'google-gemini/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    tier: 'Legacy & Fast Tier',
    description: 'Ultra fast reasoning processes for database synthesis',
    recommendedFallback: 'gemini-1.5-flash',
  },
  {
    id: 'gemini-1.5-flash',
    fullName: 'google-gemini/gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    tier: 'Legacy & Fast Tier',
    description: 'Pioneered massive context window (up to 1M tokens)',
    recommendedFallback: 'gemini-1.5-pro',
  },
  {
    id: 'gemini-1.5-pro',
    fullName: 'google-gemini/gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    tier: 'Legacy & Fast Tier',
    description: 'Foundational Pro generation for extensive document reasoning',
    recommendedFallback: 'gemini-3.6-flash',
  },
];

export const DEFAULT_GEMINI_MODEL =
  GEMINI_MODELS.find((m) => m.isDefault)?.id || 'gemini-3.6-flash';

/**
 * Normalizes a model identifier into a canonical GeminiModelInfo object.
 */
export function getGeminiModel(modelIdOrName?: string | null): GeminiModelInfo {
  if (!modelIdOrName) {
    return GEMINI_MODELS.find((m) => m.id === DEFAULT_GEMINI_MODEL) || GEMINI_MODELS[3];
  }

  const clean = modelIdOrName
    .toLowerCase()
    .trim()
    .replace(/^google-gemini\//, '')
    .replace(/^gemini\//, '');

  const match =
    GEMINI_MODELS.find((m) => m.id === clean) ||
    GEMINI_MODELS.find((m) => m.fullName.toLowerCase() === modelIdOrName.toLowerCase()) ||
    GEMINI_MODELS.find((m) => clean.includes(m.id) || m.id.includes(clean));

  return match || GEMINI_MODELS.find((m) => m.id === DEFAULT_GEMINI_MODEL) || GEMINI_MODELS[3];
}

/**
 * Resolves the next recommended fallback model if the specified model encounters a quota exceeded error.
 */
export function getNextFallbackModel(currentModelId?: string | null): GeminiModelInfo {
  const current = getGeminiModel(currentModelId);
  return getGeminiModel(current.recommendedFallback);
}

/**
 * Detects whether an error message or status code indicates a Google Gemini quota or rate limit error.
 */
export function isQuotaExceededError(errorMsgOrStatus?: string | number | null): boolean {
  if (!errorMsgOrStatus) return false;
  if (typeof errorMsgOrStatus === 'number') {
    return errorMsgOrStatus === 429;
  }

  const str = String(errorMsgOrStatus).toLowerCase();
  return (
    str.includes('429') ||
    str.includes('quota') ||
    str.includes('resourceexhausted') ||
    str.includes('resource_exhausted') ||
    str.includes('rate limit') ||
    str.includes('too many requests') ||
    str.includes('quota exceeded') ||
    str.includes('exceeded your current quota') ||
    str.includes('tokens per minute') ||
    str.includes('requests per minute')
  );
}
