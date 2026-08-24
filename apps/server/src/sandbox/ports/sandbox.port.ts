import type {
  SandboxCapabilityInfo,
  SandboxExecInput,
  SandboxExecOutput,
  SandboxProviderManifest,
} from '@orvexa/shared';

/**
 * Application-level port abstraction for isolated sandbox execution.
 * Decouples the migration rehearsal domain from TrueForge, Daytona, or Docker provider internals.
 */
export interface SandboxPort {
  /**
   * Probes the runtime environment and TrueForge instance for sandbox capabilities.
   */
  getCapability(): Promise<SandboxCapabilityInfo>;

  /**
   * Configures or updates a sandbox provider in the runtime settings.
   */
  configureProvider(manifest: SandboxProviderManifest): Promise<void>;

  /**
   * Creates an isolated ephemeral sandbox environment.
   */
  createSandbox(): Promise<{ sandboxId: string }>;

  /**
   * Executes a command within an isolated sandbox environment.
   */
  execute(params: SandboxExecInput): Promise<SandboxExecOutput>;

  /**
   * Destroys and cleans up an ephemeral sandbox environment.
   */
  cleanup(sandboxId: string): Promise<void>;
}
