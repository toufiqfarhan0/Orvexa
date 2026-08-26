/**
 * Health status descriptor for individual subsystems.
 */
export interface HealthSubsystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured' | 'mock';
  provider?: string;
  message?: string;
}

/**
 * Standard API health check response payload.
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  subsystems?: {
    database?: HealthSubsystemStatus;
    sandbox?: HealthSubsystemStatus;
  };
}

/**
 * Standard generic API success response envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Standard generic API error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}
