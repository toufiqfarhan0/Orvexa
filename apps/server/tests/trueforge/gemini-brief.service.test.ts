import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateGeminiBriefDirect } from '../../src/trueforge/services/gemini-brief.service.js';

describe('GeminiBriefService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully generates brief when Gemini API responds with candidates', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '### Executive Summary\nMigration is safe to proceed.' }],
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await generateGeminiBriefDirect({
      apiKey: 'test-gemini-key',
      prompt: 'Summarize risk findings',
      systemInstruction: 'Be concise',
    });

    expect(result.text).toBe('### Executive Summary\nMigration is safe to proceed.');
    expect(result.model).toContain('gemini');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('throws error when Gemini API returns non-200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'API key invalid',
    });

    await expect(
      generateGeminiBriefDirect({
        apiKey: 'bad-key',
        prompt: 'test prompt',
      })
    ).rejects.toThrow(/Google Gemini API error/);
  });

  it('throws error when response candidate content is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [],
      }),
    });

    await expect(
      generateGeminiBriefDirect({
        apiKey: 'key',
        prompt: 'test prompt',
      })
    ).rejects.toThrow(/empty response/);
  });
});
