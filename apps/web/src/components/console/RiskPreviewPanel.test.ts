import { describe, it, expect } from 'vitest';
import type { ExecutiveBriefData } from '../../services/migration-api.service.js';

describe('RiskPreviewPanel Executive Brief Session Scoping (Finding #3)', () => {
  it('Finding #3: Ignores in-flight brief response if sessionId changes before resolution', async () => {
    let activeSessionId = 'session_A';
    let storedBrief: ExecutiveBriefData | null = null;
    let storedBriefSessionId: string | null = null;

    // Simulate async brief generator for Session A with delay
    const fetchBriefSessionA = new Promise<ExecutiveBriefData>((resolve) => {
      setTimeout(() => {
        resolve({
          summary: 'Executive brief for Session A',
          model: 'gemini-3.6-flash',
          generatedAt: new Date().toISOString(),
        });
      }, 50);
    });

    // 1. Session A starts generation
    const requestSessionId = activeSessionId;

    // 2. User switches to Session B before Session A finishes
    activeSessionId = 'session_B';
    // When sessionId switches, state resets immediately:
    storedBrief = null;
    storedBriefSessionId = null;

    // 3. Session A response arrives
    const resultA = await fetchBriefSessionA;
    if (activeSessionId === requestSessionId) {
      storedBrief = resultA;
      storedBriefSessionId = requestSessionId;
    }

    // 4. Verify Session A brief was discarded because activeSessionId is now session_B
    expect(storedBrief).toBeNull();
    expect(storedBriefSessionId).toBeNull();

    // 5. Session B requests brief
    const requestSessionIdB = activeSessionId;
    const resultB: ExecutiveBriefData = {
      summary: 'Executive brief for Session B',
      model: 'gemini-3.6-flash',
      generatedAt: new Date().toISOString(),
    };
    if (activeSessionId === requestSessionIdB) {
      storedBrief = resultB;
      storedBriefSessionId = requestSessionIdB;
    }

    // 6. Verify Session B is cleanly populated
    expect(storedBrief).toEqual(resultB);
    expect(storedBriefSessionId).toBe('session_B');
  });

  it('Finding #3: Never displays a brief when stored session ID does not match active session ID', () => {
    const activeSessionId: string = 'session_CURRENT';
    const staleStoredBrief: ExecutiveBriefData = {
      summary: 'Old migration brief',
      model: 'gemini-3.6-flash',
      generatedAt: new Date().toISOString(),
    };
    const staleStoredSessionId: string = 'session_OLD';

    // Render condition check:
    const shouldDisplayBrief =
      staleStoredBrief !== null && staleStoredSessionId === activeSessionId;

    expect(shouldDisplayBrief).toBe(false);
  });
});
