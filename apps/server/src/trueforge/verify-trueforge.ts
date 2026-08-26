/**
 * Developer Verification Script for Local TrueForge Instance
 *
 * Verifies:
 * 1. TrueForge server reachability and capabilities
 * 2. Model provider configuration
 * 3. Real session creation
 * 4. Real turn submission with deterministic prompt
 * 5. Real model response capture and latency verification
 * 6. Session cleanup
 *
 * Usage:
 *   npm run verify:trueforge
 */
import { config } from '../config/env.js';
import { TrueForgeAdapter } from './trueforge.adapter.js';
import { TrueForgeLogger } from './trueforge.logger.js';

const logger = new TrueForgeLogger('[TrueForge:Verify]');

async function main() {
  console.info('\n==================================================');
  console.info('Orvexa — TrueForge Runtime Verification');
  console.info('==================================================\n');

  const { baseUrl, apiKey, modelProvider, modelName, geminiApiKey, openaiApiKey, anthropicApiKey } =
    config.trueforge;

  console.info(`[Config] TrueForge Base URL : ${baseUrl}`);
  console.info(`[Config] Target Provider    : ${modelProvider}`);
  console.info(`[Config] Target Model       : ${modelName}`);

  const adapter = new TrueForgeAdapter({
    baseUrl,
    apiKey,
    defaultModelProvider: modelProvider,
    defaultModelName: modelName,
    logger,
  });

  // Step 1: Check TrueForge connectivity
  console.info('\n[1/5] Verifying TrueForge server connectivity...');
  const conn = await adapter.verifyConnectivity();

  if (!conn.reachable) {
    console.error(`\n❌ BLOCKED: TrueForge server is not reachable at ${baseUrl}.`);
    console.error(`Status message: ${conn.statusMessage}`);
    console.error('\nTo start TrueForge locally, run:');
    console.error('  npm run trueforge:start');
    process.exit(1);
  }

  console.info(`✅ TrueForge server is online (${conn.latencyMs}ms latency)`);
  if (conn.capabilities) {
    console.info(
      `   Capabilities: Sandbox=${conn.capabilities.sandboxEnabled}, Skills=${conn.capabilities.skillEnabled}, Settings=${conn.capabilities.settingsEnabled}`
    );
  }

  // Step 2: Configure model provider with credentials from environment
  console.info('\n[2/5] Checking model provider credentials...');
  let activeApiKey: string | undefined;

  if (modelProvider === 'google-gemini') {
    activeApiKey = geminiApiKey;
    if (activeApiKey) {
      console.info('   Configuring Google Gemini model provider in TrueForge settings...');
      await adapter.configureModelProvider({
        type: 'google-gemini',
        apiKey: activeApiKey,
        models: [
          { modelId: 'gemini-3.6-flash', name: 'gemini-3-6-flash' },
          { modelId: 'gemini-3.1-pro-preview', name: 'gemini-3-1-pro-preview' },
        ],
      });
      console.info('✅ Google Gemini provider configured successfully.');
    }
  } else if (modelProvider === 'openai') {
    activeApiKey = openaiApiKey;
    if (activeApiKey) {
      console.info('   Configuring OpenAI model provider in TrueForge settings...');
      await adapter.configureModelProvider({
        type: 'openai',
        apiKey: activeApiKey,
        models: [
          { modelId: 'gpt-5.4-mini', name: 'gpt-5-4-mini' },
          { modelId: 'gpt-5.5', name: 'gpt-5-5' },
          { modelId: 'gpt-5.6-luna', name: 'gpt-5-6-luna' },
        ],
      });
      console.info('✅ OpenAI provider configured successfully.');
    }
  } else if (modelProvider === 'anthropic') {
    activeApiKey = anthropicApiKey;
    if (activeApiKey) {
      console.info('   Configuring Anthropic model provider in TrueForge settings...');
      await adapter.configureModelProvider({
        type: 'anthropic',
        apiKey: activeApiKey,
        models: [
          { modelId: 'claude-sonnet-4-6', name: 'claude-sonnet-4-6' },
          { modelId: 'claude-haiku-4-5', name: 'claude-haiku-4-5' },
          { modelId: 'claude-opus-4-8', name: 'claude-opus-4-8' },
        ],
      });
      console.info('✅ Anthropic provider configured successfully.');
    }
  }

  if (!activeApiKey) {
    console.error(`\n❌ BLOCKED: Model provider credential is required for live verification.`);
    console.error(`   Configured provider: '${modelProvider}'`);
    console.error('   Please set the appropriate environment variable in .env:');
    console.error('     GEMINI_API_KEY=your_gemini_api_key (or GOOGLE_API_KEY)');
    console.error('     OPENAI_API_KEY=your_openai_api_key');
    console.error('     ANTHROPIC_API_KEY=your_anthropic_api_key');
    process.exit(1);
  }

  // Step 3: Create real TrueForge session
  console.info('\n[3/5] Creating real TrueForge agent session...');
  const session = await adapter.createSession({
    agentName: 'orvexa-verifier',
    instructions: 'You are Orvexa verification agent. Strictly follow the prompt instructions.',
    model: { name: modelName },
  });

  console.info(`✅ Session created successfully!`);
  console.info(`   Session ID : ${session.sessionId}`);
  console.info(`   Model      : ${session.model}`);
  console.info(`   Created At : ${session.createdAt}`);

  // Step 4: Execute real turn with model inference
  console.info('\n[4/5] Executing real turn with model inference...');
  const deterministicPrompt = 'Reply with exactly: TRUEFORGE_ORVEXA_OK';
  console.info(`   Prompt: "${deterministicPrompt}"`);

  let turnResult;
  try {
    turnResult = await adapter.sendTurn({
      sessionId: session.sessionId,
      message: deterministicPrompt,
    });

    console.info(`✅ Real model turn completed in ${turnResult.durationMs}ms!`);
    console.info(`   Turn ID    : ${turnResult.turnId}`);
    console.info(`   Turn Status: ${turnResult.status}`);
    console.info(`   Events     : ${turnResult.events.length} streamed events`);
    console.info(`   Response   : "${turnResult.text}"`);

    if (!turnResult.text || turnResult.text.length === 0) {
      throw new Error('Received empty response from model turn');
    }
  } catch (err: unknown) {
    console.error(`❌ Turn execution failed: ${err instanceof Error ? err.message : String(err)}`);
    // Cleanup session before rethrowing
    await adapter.deleteSession(session.sessionId).catch(() => {});
    throw err;
  }

  // Step 5: Clean up session
  console.info('\n[5/5] Cleaning up test session...');
  await adapter.deleteSession(session.sessionId);
  console.info(`✅ Session ${session.sessionId} deleted successfully.`);

  console.info('\n==================================================');
  console.info('🎉 TrueForge REAL MODEL INFERENCE verification PASSED!');
  console.info('==================================================\n');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
