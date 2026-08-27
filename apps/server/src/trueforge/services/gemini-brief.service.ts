import { TrueForgeLogger, trueforgeLogger } from '../trueforge.logger.js';

export interface GenerateGeminiBriefOptions {
  apiKey: string;
  modelName?: string;
  prompt: string;
  systemInstruction?: string;
  logger?: TrueForgeLogger;
  timeoutMs?: number;
}

export interface GeminiBriefResult {
  text: string;
  model: string;
  durationMs: number;
}

/**
 * Direct Google Gemini API caller used when TrueForge daemon is unreachable or operating in serverless cloud environments.
 */
export async function generateGeminiBriefDirect(
  options: GenerateGeminiBriefOptions
): Promise<GeminiBriefResult> {
  const startTime = Date.now();
  const logger = options.logger || trueforgeLogger;
  const timeoutMs = options.timeoutMs || 30000;

  // Normalize model identifier (e.g. "google-gemini/gemini-3.6-flash" -> "gemini-3.6-flash")
  let targetModel = options.modelName || 'gemini-3.6-flash';
  if (targetModel.includes('/')) {
    targetModel = targetModel.split('/')[1];
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(options.apiKey)}`;

  logger.info('Invoking Google Gemini direct generation endpoint', {
    model: targetModel,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload: {
      contents: { role: string; parts: { text: string }[] }[];
      systemInstruction?: { parts: { text: string }[] };
    } = {
      contents: [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
        },
      ],
    };

    if (options.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errBody = await response.text();
      logger.warn('Gemini direct API returned non-200', {
        status: response.status,
        statusText: response.statusText,
        error: errBody.slice(0, 300),
      });
      throw new Error(`Google Gemini API error (HTTP ${response.status}): ${response.statusText}`);
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { text?: string }[];
        };
      }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text.trim()) {
      throw new Error('Google Gemini returned an empty response.');
    }

    logger.info('Gemini direct generation completed successfully', {
      durationMs,
      textLength: text.length,
    });

    return {
      text,
      model: `google-gemini/${targetModel}`,
      durationMs,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Gemini direct generation failed:', { error: msg });
    throw err;
  }
}
