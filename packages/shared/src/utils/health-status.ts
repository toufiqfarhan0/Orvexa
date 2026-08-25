export type BackendHealthState = 'connected' | 'degraded' | 'error' | 'offline' | 'checking';

export interface HealthDisplayConfig {
  label: string;
  badgeClass: string;
  colorVar: string;
  tooltip: string;
}

/**
 * Maps raw API health check status strings to standardized health states.
 */
export function mapHealthStatus(status: string | null | undefined): BackendHealthState {
  if (!status) return 'offline';
  const normalized = status.toLowerCase().trim();
  if (normalized === 'ok' || normalized === 'healthy') return 'connected';
  if (normalized === 'degraded' || normalized === 'warning') return 'degraded';
  if (normalized === 'error' || normalized === 'unhealthy') return 'error';
  return 'offline';
}

/**
 * Returns consistent UI styling and text tokens for each health state.
 */
export function getHealthDisplayConfig(healthState: BackendHealthState): HealthDisplayConfig {
  switch (healthState) {
    case 'connected':
      return {
        label: 'Engine Ready',
        badgeClass: 'badge-success',
        colorVar: 'var(--status-success)',
        tooltip: 'Backend Server Engine Operational',
      };
    case 'degraded':
      return {
        label: 'Degraded',
        badgeClass: 'badge-warning',
        colorVar: 'var(--status-warning)',
        tooltip: 'Backend Server Operating with Degraded Health',
      };
    case 'error':
      return {
        label: 'Error',
        badgeClass: 'badge-error',
        colorVar: 'var(--status-error)',
        tooltip: 'Backend Server Engine Error',
      };
    case 'checking':
      return {
        label: 'Connecting',
        badgeClass: 'badge-neutral',
        colorVar: 'var(--text-secondary)',
        tooltip: 'Probing Backend Engine Status',
      };
    case 'offline':
    default:
      return {
        label: 'Standby',
        badgeClass: 'badge-neutral',
        colorVar: 'var(--text-muted)',
        tooltip: 'Backend Server Offline or Unreachable',
      };
  }
}
