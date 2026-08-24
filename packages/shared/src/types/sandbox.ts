/**
 * Status of the sandbox rehearsal run.
 */
export type SandboxRehearsalStatus = 'SUCCESS' | 'FAILED' | 'TIMED_OUT';

/**
 * Result metrics and logs from a dry-run / rehearsal executed in an isolated PostgreSQL sandbox.
 */
export interface SandboxRehearsalResult {
  rehearsalId: string;
  status: SandboxRehearsalStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  simulatedLockAcquisitionMs: number;
  rowsAffected: number;
  statementsExecuted: number;
  rollbackVerified: boolean;
  logs: string[];
  errorMessage?: string;
  sandboxEnvironmentId?: string;
}

/**
 * Capability details for the sandbox execution environment.
 */
export interface SandboxCapabilityInfo {
  enabled: boolean;
  providerType: 'local' | 'daytona' | 'docker' | 'none';
  status: 'ready' | 'pending' | 'failed' | 'disabled';
  reason?: string | null;
  supportedPlatforms: string[];
  currentPlatform: string;
}

/**
 * Parameters for executing a command inside an isolated sandbox.
 */
export interface SandboxExecInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutSeconds?: number;
  sandboxId?: string;
}

/**
 * Result of a command execution inside an isolated sandbox.
 */
export interface SandboxExecOutput {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
  sandboxId?: string;
}

/**
 * Configuration manifest for TrueForge sandbox providers.
 */
export interface SandboxProviderManifest {
  type: 'daytona' | 'local';
  auth?: {
    apiKey: string;
  };
  execTimeoutMs?: number;
  autoStopIntervalInMinutes?: number;
  autoArchiveIntervalInMinutes?: number;
  autoDeleteIntervalInMinutes?: number;
}
