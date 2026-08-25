import { describe, it, expect } from 'vitest';
import { mapHealthStatus, getHealthDisplayConfig } from '@orvexa/shared';

describe('Health Status Mapping and UI Config', () => {
  describe('mapHealthStatus', () => {
    it('maps "ok" and "healthy" to "connected"', () => {
      expect(mapHealthStatus('ok')).toBe('connected');
      expect(mapHealthStatus('OK')).toBe('connected');
      expect(mapHealthStatus('healthy')).toBe('connected');
    });

    it('maps "degraded" and "warning" to "degraded"', () => {
      expect(mapHealthStatus('degraded')).toBe('degraded');
      expect(mapHealthStatus('DEGRADED')).toBe('degraded');
      expect(mapHealthStatus('warning')).toBe('degraded');
    });

    it('maps "error" and "unhealthy" to "error"', () => {
      expect(mapHealthStatus('error')).toBe('error');
      expect(mapHealthStatus('ERROR')).toBe('error');
      expect(mapHealthStatus('unhealthy')).toBe('error');
    });

    it('maps null, undefined, empty, and unknown statuses to "offline"', () => {
      expect(mapHealthStatus(null)).toBe('offline');
      expect(mapHealthStatus(undefined)).toBe('offline');
      expect(mapHealthStatus('')).toBe('offline');
      expect(mapHealthStatus('unknown_status')).toBe('offline');
    });
  });

  describe('getHealthDisplayConfig', () => {
    it('returns success tokens for connected state', () => {
      const config = getHealthDisplayConfig('connected');
      expect(config.label).toBe('Engine Ready');
      expect(config.badgeClass).toBe('badge-success');
      expect(config.colorVar).toBe('var(--status-success)');
    });

    it('returns warning tokens for degraded state', () => {
      const config = getHealthDisplayConfig('degraded');
      expect(config.label).toBe('Degraded');
      expect(config.badgeClass).toBe('badge-warning');
      expect(config.colorVar).toBe('var(--status-warning)');
    });

    it('returns error tokens for error state', () => {
      const config = getHealthDisplayConfig('error');
      expect(config.label).toBe('Error');
      expect(config.badgeClass).toBe('badge-error');
      expect(config.colorVar).toBe('var(--status-error)');
    });

    it('returns neutral tokens for checking and offline states', () => {
      const checking = getHealthDisplayConfig('checking');
      expect(checking.label).toBe('Connecting');
      expect(checking.badgeClass).toBe('badge-neutral');

      const offline = getHealthDisplayConfig('offline');
      expect(offline.label).toBe('Standby');
      expect(offline.badgeClass).toBe('badge-neutral');
    });
  });
});
