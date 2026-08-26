/**
 * SchemaSentry & TrueForge Real MCP Verification Utility
 *
 * Demonstrates and verifies the complete end-to-end integration:
 * User / Verifier
 *   ↓
 * TrueForge Agent Session
 *   ↓ (MCP protocol over SSE)
 * SchemaSentry MCP Server (/api/mcp)
 *   ↓
 * PostgresInspectionService / PgInspectionAdapter
 *   ↓
 * Real PostgreSQL Database (events table)
 *   ↓ (Structured InspectPostgresTargetOutput)
 * TrueForge Agent Harness
 *   ↓
 * Real Google Gemini Inference & Natural Language Summary
 */
import 'dotenv/config';
import http from 'http';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { TrueForgeAdapter } from '../trueforge/trueforge.adapter.js';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';

const MCP_TEST_PORT = 4005;
const MCP_SERVER_URL = `http://localhost:${MCP_TEST_PORT}/api/mcp`;
const logger = new TrueForgeLogger('[Orvexa:VerifyMCP]');

async function main(): Promise<void> {
  console.info('==================================================');
  console.info('Orvexa — TrueForge MCP Integration Verification');
  console.info('==================================================\n');

  const { baseUrl, apiKey, modelProvider, modelName, geminiApiKey } = config.trueforge;

  console.info(`[Config] TrueForge Base URL : ${baseUrl}`);
  console.info(`[Config] MCP Server URL     : ${MCP_SERVER_URL}`);
  console.info(`[Config] Target Provider    : ${modelProvider}`);
  console.info(`[Config] Target Model       : ${modelName}\n`);

  // Step 1: Start local SchemaSentry MCP Server on MCP_TEST_PORT
  console.info('[1/7] Starting local SchemaSentry MCP Server on port ' + MCP_TEST_PORT + '...');
  const inspectionAdapter = new PgInspectionAdapter({ connectionString: config.databaseUrl });
  const app = createApp({ inspectionPort: inspectionAdapter });
  const httpServer = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(MCP_TEST_PORT, () => resolve());
    httpServer.on('error', reject);
  });
  console.info(`✅ SchemaSentry MCP Server listening at ${MCP_SERVER_URL}\n`);

  const adapter = new TrueForgeAdapter({
    baseUrl,
    apiKey,
    logger,
  });

  try {
    // Step 2: Verify TrueForge Connectivity
    console.info('[2/7] Checking TrueForge server connectivity...');
    const conn = await adapter.verifyConnectivity();
    if (!conn.reachable) {
      throw new Error(`TrueForge server unreachable at ${baseUrl}`);
    }
    console.info(`✅ TrueForge server is online (${conn.latencyMs}ms latency)\n`);

    // Step 3: Configure Provider Credentials in TrueForge
    console.info('[3/7] Ensuring model provider is configured in TrueForge...');
    if (modelProvider === 'google-gemini' && geminiApiKey) {
      await adapter.configureModelProvider({
        type: 'google-gemini',
        apiKey: geminiApiKey,
        models: [
          { modelId: 'gemini-3.6-flash', name: 'gemini-3-6-flash' },
          { modelId: 'gemini-3.1-pro-preview', name: 'gemini-3-1-pro-preview' },
        ],
      });
      console.info('✅ Google Gemini provider configured successfully.\n');
    }

    // Step 4: Register SchemaSentry MCP Server in TrueForge
    console.info('[4/7] Registering SchemaSentry MCP server in TrueForge settings...');
    await adapter.configureMcpServer({
      name: 'schemasentry',
      description: 'SchemaSentry Read-Only PostgreSQL Schema and Catalog Inspection Tools',
      type: 'remote',
      url: MCP_SERVER_URL,
    });
    console.info(`✅ SchemaSentry MCP server registered with URL: ${MCP_SERVER_URL}\n`);

    // Step 5: Verify TrueForge Discovers MCP Tools
    console.info('[5/7] Verifying TrueForge tool discovery for "schemasentry"...');
    const tools = await adapter.listMcpServerTools('schemasentry');
    console.info(`✅ TrueForge discovered tools: ${JSON.stringify(tools)}`);
    if (!tools.includes('inspect_postgres_target')) {
      throw new Error('inspect_postgres_target not discovered by TrueForge!');
    }
    console.info('');

    // Step 6: Create Agent Session with SchemaSentry MCP Tool Attached
    console.info('[6/7] Creating TrueForge Agent session with MCP tool attached...');
    const session = await adapter.createSession({
      agentName: 'schemasentry-mcp-agent',
      instructions:
        'You are SchemaSentry, an expert PostgreSQL database migration safety agent. ' +
        'When asked to inspect a database table, use the inspect_postgres_target tool to query the live catalog, ' +
        'and explain the column types, constraints, indexes, and estimated row count clearly and concisely.',
      model: {
        name: modelName,
      },
      mcpServers: [
        {
          name: 'schemasentry',
        },
      ],
    });
    console.info(`✅ Agent Session created: ${session.sessionId}\n`);

    // Step 7: Send Real Turn Requiring MCP Tool Invocation
    const prompt =
      'Inspect the public.events PostgreSQL table using the available SchemaSentry inspection tool. ' +
      'Tell me how many estimated rows it has, which indexes exist, and which columns are present.';

    console.info(
      '[7/7] Dispatching real agent turn (TrueForge Agent → MCP Tool → PostgreSQL → Gemini Summary)...'
    );
    console.info(`   Prompt: "${prompt}"\n`);

    const turnResult = await adapter.sendTurn({
      sessionId: session.sessionId,
      message: prompt,
    });

    console.info('==================================================');
    console.info('🎉 REAL MCP TOOL INVOCATION & INFERENCE SUCCEEDED!');
    console.info('==================================================');
    console.info(`Session ID   : ${session.sessionId}`);
    console.info(`Turn ID      : ${turnResult.turnId}`);
    console.info(`Turn Status  : ${turnResult.status}`);
    console.info(`Duration     : ${turnResult.durationMs}ms`);
    console.info(`Events Count : ${turnResult.events.length}`);
    console.info('\n--- Model Response ---');
    console.info(turnResult.text);
    console.info('----------------------\n');

    // Cleanup session
    await adapter.deleteSession(session.sessionId);
    console.info(`✅ Cleaned up agent session ${session.sessionId}`);
  } finally {
    // Teardown HTTP server and DB connections
    await inspectionAdapter.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    console.info('✅ Local test MCP server stopped.\n');
  }
}

main().catch((err) => {
  console.error('\n❌ MCP Verification failed:', err);
  process.exit(1);
});
