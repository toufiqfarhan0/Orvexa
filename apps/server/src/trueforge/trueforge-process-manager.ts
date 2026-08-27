import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TrueForgeLogger, trueforgeLogger } from './trueforge.logger.js';
import { getLoopbackCandidateUrls } from './trueforge.adapter.js';

let trueforgeChildProcess: ChildProcess | null = null;

export interface TrueForgeDaemonOptions {
  baseUrl?: string;
  autoSpawn?: boolean;
  logger?: TrueForgeLogger;
  port?: number;
  probeTimeoutMs?: number;
  maxWaitMs?: number;
  intervalMs?: number;
}

/**
 * Checks if TrueForge agent server is actively reachable on the given baseUrl.
 */
export async function isTrueForgeReachable(
  baseUrl: string,
  timeoutMs: number = 2000
): Promise<boolean> {
  if (!baseUrl || baseUrl.trim() === '') {
    return false;
  }
  const candidateUrls = getLoopbackCandidateUrls(baseUrl);

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
 * and not already reachable. In production, local auto-spawning is disabled by default.
 */
export async function startTrueForgeDaemonIfNeeded(
  options?: TrueForgeDaemonOptions
): Promise<ChildProcess | null> {
  const logger = options?.logger || trueforgeLogger;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const autoSpawn =
    options?.autoSpawn !== undefined
      ? options.autoSpawn
      : process.env.TRUEFORGE_AUTO_SPAWN_DAEMON !== undefined
        ? process.env.TRUEFORGE_AUTO_SPAWN_DAEMON === 'true'
        : !isProduction;

  if (!autoSpawn) {
    logger.debug('TrueForge local daemon auto-spawn is disabled.');
    return null;
  }

  const defaultBaseUrl = isProduction ? '' : 'http://127.0.0.1:8790';
  const baseUrl =
    options?.baseUrl !== undefined
      ? options.baseUrl
      : process.env.TRUEFORGE_BASE_URL !== undefined
        ? process.env.TRUEFORGE_BASE_URL
        : defaultBaseUrl;
  const probeTimeoutMs = options?.probeTimeoutMs || 2000;

  if (!baseUrl || baseUrl.trim() === '') {
    logger.debug('TrueForge base URL is empty; skipping local daemon spawn.');
    return null;
  }

  let isLocalhost = false;
  try {
    const url = new URL(baseUrl);
    isLocalhost =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1' ||
      url.hostname === '0.0.0.0';
  } catch {
    logger.warn(`Invalid TrueForge base URL format: ${baseUrl}`);
    return null;
  }

  if (!isLocalhost) {
    logger.info(`Using remote TrueForge agent service at ${baseUrl}`);
    return null;
  }

  const alreadyRunning = await isTrueForgeReachable(baseUrl, probeTimeoutMs);
  if (alreadyRunning) {
    logger.info(`TrueForge agent server is already running and reachable at ${baseUrl}`);
    return null;
  }

  const parsedUrl = new URL(baseUrl);
  const port = options?.port || Number(parsedUrl.port) || 8790;

  try {
    const require = createRequire(import.meta.url);
    const cliPath = require.resolve('@truefoundry/trueforge/dist/cli.js');

    const isWin = process.platform === 'win32';
    const defaultSqlitePath = isWin ? 'C:\\tmp\\trueforge-orvexa.db' : '/tmp/trueforge-orvexa.db';
    const sqlitePath = process.env.SQLITE_PATH || defaultSqlitePath;
    const xdgDataHome = process.env.XDG_DATA_HOME || (isWin ? 'C:\\tmp' : '/tmp');

    // Explicit directory provisioning: Let filesystem errors (e.g. permission/path conflicts)
    // propagate to the outer catch handler rather than swallowing them into a broken spawn.
    mkdirSync(dirname(sqlitePath), { recursive: true });
    mkdirSync(xdgDataHome, { recursive: true });

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
        SQLITE_PATH: sqlitePath,
        // Override XDG_DATA_HOME so env-paths resolves to /tmp on Linux
        XDG_DATA_HOME: xdgDataHome,
        // Suppress color codes in subprocess output for cleaner logs
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    child.stdout?.on('data', (data: Buffer) => {
      const raw = data.toString();
      for (const rawLine of raw.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length > 0) {
          logger.info(`[TrueForge Engine] ${line}`);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const raw = data.toString();
      for (const rawLine of raw.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length > 0) {
          // Suppress the standalone mode warning box line (expected, not an error)
          if (line.includes('Standalone mode is intended for local use')) continue;
          logger.warn(`[TrueForge Engine] ${line}`);
        }
      }
    });

    child.on('error', (err: Error) => {
      logger.error('Failed to spawn TrueForge agent daemon:', { error: err.message });
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      if (code !== 0 && code !== null) {
        logger.error(
          `TrueForge agent daemon exited unexpectedly with code ${code} (signal: ${signal}). ` +
            `Check SQLITE_PATH=${sqlitePath} is writable.`
        );
      } else {
        logger.debug(`TrueForge agent daemon stopped.`);
      }
      if (trueforgeChildProcess === child) {
        trueforgeChildProcess = null;
      }
    });

    trueforgeChildProcess = child;

    // Wait up to maxWaitMs for TrueForge to be ready (cloud containers can be slow)
    const maxWaitMs = options?.maxWaitMs ?? 30_000;
    const intervalMs = options?.intervalMs ?? 600;
    const iterations = Math.max(1, Math.ceil(maxWaitMs / intervalMs));
    let started = false;
    for (let i = 0; i < iterations; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      // Early exit if process died during startup
      if (trueforgeChildProcess !== child) {
        logger.warn('TrueForge child process terminated prematurely during startup.');
        break;
      }

      const isUp = await isTrueForgeReachable(baseUrl, 1000);
      if (isUp) {
        logger.info(`TrueForge agent daemon started successfully and listening at ${baseUrl}`);
        started = true;
        break;
      }
    }

    if (!started) {
      logger.warn(`TrueForge daemon did not respond within ${maxWaitMs}ms. Cleaning up process.`);
      if (trueforgeChildProcess === child) {
        try {
          child.kill('SIGTERM');
        } catch {
          // Ignore if already dead
        }
        trueforgeChildProcess = null;
      }
      return null;
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
