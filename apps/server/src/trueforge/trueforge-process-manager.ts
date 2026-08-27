import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import { TrueForgeLogger, trueforgeLogger } from './trueforge.logger.js';

let trueforgeChildProcess: ChildProcess | null = null;

export interface TrueForgeDaemonOptions {
  baseUrl?: string;
  logger?: TrueForgeLogger;
  port?: number;
  probeTimeoutMs?: number;
}

/**
 * Checks if TrueForge agent server is actively reachable on the given baseUrl.
 */
export async function isTrueForgeReachable(
  baseUrl: string,
  timeoutMs: number = 2000
): Promise<boolean> {
  const probeUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/capabilities`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(probeUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the TrueForge server daemon as a managed child process if running locally
 * and not already reachable.
 */
export async function startTrueForgeDaemonIfNeeded(
  options?: TrueForgeDaemonOptions
): Promise<ChildProcess | null> {
  const baseUrl = options?.baseUrl || process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790';
  const logger = options?.logger || trueforgeLogger;
  const probeTimeoutMs = options?.probeTimeoutMs || 2000;

  const url = new URL(baseUrl);
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '::1' ||
    url.hostname === '0.0.0.0';

  if (!isLocalhost) {
    logger.info(`Using remote TrueForge agent service at ${baseUrl}`);
    return null;
  }

  const alreadyRunning = await isTrueForgeReachable(baseUrl, probeTimeoutMs);
  if (alreadyRunning) {
    logger.info(`TrueForge agent server is already running and reachable at ${baseUrl}`);
    return null;
  }

  const port = options?.port || Number(url.port) || 8790;

  try {
    const require = createRequire(import.meta.url);
    const cliPath = require.resolve('@truefoundry/trueforge/dist/cli.js');

    logger.info(`Auto-spawning TrueForge agent daemon on port ${port}...`);

    const child = spawn(process.execPath, [cliPath, '--port', String(port)], {
      env: {
        ...process.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.length > 0) {
        logger.debug(`[TrueForge Engine] ${line}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.length > 0) {
        logger.warn(`[TrueForge Engine] ${line}`);
      }
    });

    child.on('error', (err: Error) => {
      logger.error('Failed to spawn TrueForge agent daemon:', { error: err.message });
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      if (code !== 0 && code !== null) {
        logger.warn(`TrueForge agent daemon exited with code ${code} (signal: ${signal})`);
      } else {
        logger.debug(`TrueForge agent daemon stopped.`);
      }
      if (trueforgeChildProcess === child) {
        trueforgeChildProcess = null;
      }
    });

    trueforgeChildProcess = child;

    // Wait briefly for startup
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const isUp = await isTrueForgeReachable(baseUrl, 500);
      if (isUp) {
        logger.info(`TrueForge agent daemon started successfully and listening at ${baseUrl}`);
        break;
      }
    }

    return child;
  } catch (err) {
    logger.warn('Could not auto-start TrueForge daemon:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Gracefully stops the managed TrueForge daemon process if running.
 */
export function stopManagedTrueForgeDaemon(): void {
  if (trueforgeChildProcess && !trueforgeChildProcess.killed) {
    trueforgeLogger.info('Stopping managed TrueForge agent daemon...');
    try {
      trueforgeChildProcess.kill('SIGTERM');
    } catch {
      // Ignore if already exited
    }
    trueforgeChildProcess = null;
  }
}
