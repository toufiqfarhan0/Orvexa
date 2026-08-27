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
  // Try both localhost and 127.0.0.1 to handle IPv4/IPv6 ambiguity on Linux containers
  const candidateUrls = [baseUrl];
  if (baseUrl.includes('localhost')) {
    candidateUrls.push(baseUrl.replace('localhost', '127.0.0.1'));
  } else if (baseUrl.includes('127.0.0.1')) {
    candidateUrls.push(baseUrl.replace('127.0.0.1', 'localhost'));
  }

  for (const url of candidateUrls) {
    const probeUrl = `${url.replace(/\/+$/, '')}/api/v1/capabilities`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (res.ok) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
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
        // Bind to all interfaces so the daemon is reachable via both localhost
        // and 127.0.0.1 on Linux containers (Render, Docker, etc.)
        HOST: '0.0.0.0',
        PORT: String(port),
        STANDALONE: 'true',
        // On cloud/container environments (Render, Docker), the home directory
        // may not be writable. Force TrueForge data to /tmp which is always writable.
        SQLITE_PATH: process.env.SQLITE_PATH || '/tmp/trueforge-orvexa.db',
        // Override XDG_DATA_HOME so env-paths resolves to /tmp on Linux
        XDG_DATA_HOME: process.env.XDG_DATA_HOME || '/tmp',
        // Suppress color codes in subprocess output for cleaner logs
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.length > 0) {
        logger.info(`[TrueForge Engine] ${line}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.length > 0) {
        // Suppress the standalone mode warning (expected, not an error)
        if (line.includes('Standalone mode is intended for local use')) return;
        logger.warn(`[TrueForge Engine] ${line}`);
      }
    });

    child.on('error', (err: Error) => {
      logger.error('Failed to spawn TrueForge agent daemon:', { error: err.message });
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      if (code !== 0 && code !== null) {
        logger.error(
          `TrueForge agent daemon exited unexpectedly with code ${code} (signal: ${signal}). ` +
            `Check SQLITE_PATH=/tmp/trueforge-orvexa.db is writable.`
        );
      } else {
        logger.debug(`TrueForge agent daemon stopped.`);
      }
      if (trueforgeChildProcess === child) {
        trueforgeChildProcess = null;
      }
    });

    trueforgeChildProcess = child;

    // Wait up to 30s for TrueForge to be ready (cloud containers can be slow)
    const maxWaitMs = 30_000;
    const intervalMs = 600;
    const iterations = Math.ceil(maxWaitMs / intervalMs);
    let started = false;
    for (let i = 0; i < iterations; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const isUp = await isTrueForgeReachable(baseUrl, 1000);
      if (isUp) {
        logger.info(`TrueForge agent daemon started successfully and listening at ${baseUrl}`);
        started = true;
        break;
      }
    }
    if (!started) {
      logger.warn(
        `TrueForge daemon did not respond within ${maxWaitMs}ms. It may still be initializing.`
      );
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
