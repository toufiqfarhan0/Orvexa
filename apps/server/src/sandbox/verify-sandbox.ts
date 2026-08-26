/**
 * SchemaSentry & TrueForge Real Sandbox Verification Utility
 *
 * Demonstrates:
 * 1. Probing TrueForge server reachability and sandbox capabilities
 * 2. Inspecting sandbox provider configuration and platform support
 * 3. Testing real TrueForge sandbox creation
 * 4. Executing deterministic test command inside TrueForge sandbox
 * 5. Verifying stdout/stderr output and cleanup
 * 6. Failing fast if TrueForge sandbox capability is disabled (zero silent fallback)
 * 7. Operating with ZERO model / Gemini inference calls
 */
import 'dotenv/config';
import { config } from '../config/env.js';
import { TrueForgeSandboxAdapter } from './adapters/trueforge-sandbox.adapter.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';

const logger = new TrueForgeLogger('[Orvexa:VerifySandbox]');

async function main(): Promise<void> {
  console.info('==================================================');
  console.info('Orvexa — Real TrueForge Sandbox Verification');
  console.info('==================================================\n');

  const { baseUrl, apiKey } = config.trueforge;

  console.info(`[Config] TrueForge Base URL : ${baseUrl}`);
  console.info(`[Config] Host Platform      : ${process.platform}\n`);

  const adapter = new TrueForgeSandboxAdapter({
    baseUrl,
    apiKey,
    logger,
  });

  // Step 1: Probe TrueForge Sandbox Capabilities
  console.info('[1/4] Probing TrueForge server and sandbox capabilities...');
  const capability = await adapter.getCapability();

  console.info(`   Sandbox Enabled     : ${capability.enabled}`);
  console.info(`   Provider Type       : ${capability.providerType}`);
  console.info(`   Status              : ${capability.status}`);
  console.info(`   Supported Platforms : ${capability.supportedPlatforms.join(', ')}`);
  console.info(`   Current Platform    : ${capability.currentPlatform}`);
  if (capability.reason) {
    console.info(`   Status Reason       : ${capability.reason}`);
  }

  if (!capability.enabled) {
    console.error('\n❌ TRUEFORGE SANDBOX UNAVAILABLE');
    console.error(`   The TrueForge server reports sandbox.enabled = false.`);
    console.error(`   Exact Reason: ${capability.reason || 'No sandbox provider ready'}`);
    console.error('   This milestone strictly forbids silent fallback to local execution.');
    process.exit(1);
  }

  console.info('✅ Capability probe confirmed sandbox is ENABLED.\n');

  // Step 2: Create Real TrueForge Sandbox
  console.info('[2/4] Creating real TrueForge sandbox session...');
  const created = await adapter.createSandbox();
  const sandboxId = created.sandboxId;
  console.info(`✅ Real TrueForge Sandbox session created: ${sandboxId}\n`);

  try {
    // Step 3: Execute Deterministic Command inside TrueForge Sandbox
    console.info('[3/4] Executing deterministic command in TrueForge sandbox...');
    const command = `node -e "console.log('ORVEXA_TRUEFORGE_SANDBOX_OK')"`;
    console.info(`   Command: ${command}`);

    const execResult = await adapter.execute({
      sandboxId,
      command,
      timeoutSeconds: 10,
    });

    console.info(`   Success   : ${execResult.success}`);
    console.info(`   Exit Code : ${execResult.exitCode}`);
    console.info(`   Duration  : ${execResult.durationMs}ms`);
    console.info(`   Stdout    : ${execResult.stdout.trim()}`);
    if (execResult.stderr) {
      console.info(`   Stderr    : ${execResult.stderr.trim()}`);
    }

    if (!execResult.stdout.includes('ORVEXA_TRUEFORGE_SANDBOX_OK')) {
      throw new Error(
        `Sandbox command did not return expected output ORVEXA_TRUEFORGE_SANDBOX_OK (got: ${execResult.stdout})`
      );
    }
    console.info('✅ Deterministic TrueForge sandbox command output verified successfully.\n');
  } finally {
    // Step 4: Cleanup Sandbox Environment
    console.info('[4/4] Cleaning up TrueForge sandbox session...');
    await adapter.cleanup(sandboxId);
    console.info(`✅ Cleaned up TrueForge sandbox session: ${sandboxId}`);
  }

  console.info('\n==================================================');
  console.info('🎉 TrueForge Real Sandbox Verification PASSED successfully!');
  console.info('==================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Sandbox Verification failed:', err);
  process.exit(1);
});
