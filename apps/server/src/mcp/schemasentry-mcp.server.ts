/**
 * SchemaSentry Model Context Protocol (MCP) Server
 *
 * Implements the official MCP server protocol for SchemaSentry database inspection tools.
 * Exposes inspect_postgres_target tool to TrueForge AI agents over standard SSE transport.
 */
import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import type { PostgresInspectionPort } from '../db/ports/postgres-inspection.port.js';
import { InspectPostgresHandler } from './handlers/inspect-postgres.handler.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';

export interface SchemaSentryMcpServerOptions {
  inspectionPort: PostgresInspectionPort;
  logger?: TrueForgeLogger;
  baseMessagePath?: string;
}

export class SchemaSentryMcpServer {
  private readonly handler: InspectPostgresHandler;
  private readonly logger: TrueForgeLogger;
  private readonly baseMessagePath: string;
  private readonly transports: Map<string, SSEServerTransport> = new Map();

  constructor(options: SchemaSentryMcpServerOptions) {
    this.logger = options.logger || new TrueForgeLogger('[SchemaSentry:MCP]');
    this.handler = new InspectPostgresHandler(options.inspectionPort);
    this.baseMessagePath = options.baseMessagePath || '/api/mcp/messages';
  }

  /**
   * Creates and registers tools on a fresh McpServer instance for a transport session.
   */
  public createMcpServerInstance(): McpServer {
    const server = new McpServer({
      name: 'schemasentry',
      version: '1.0.0',
    });

    server.tool(
      'inspect_postgres_target',
      'Inspects a PostgreSQL table schema, column definitions, constraints, indexes, statistics, and lock activity for migration risk analysis. Read-only operation.',
      {
        schema: z
          .string()
          .optional()
          .default('public')
          .describe('Target PostgreSQL schema name (defaults to "public")'),
        table: z
          .string()
          .describe('Target PostgreSQL table name to inspect (e.g. "users", "events")'),
        includeDependencies: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether to include foreign key dependencies and referential constraints'),
      },
      async (args) => {
        this.logger.info('Executing inspect_postgres_target tool', {
          schema: args.schema || 'public',
          table: args.table,
        });

        try {
          const result = await this.handler.handle(args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error('inspect_postgres_target tool execution failed', {
            error: errorMessage,
            table: args.table,
          });

          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: errorMessage,
                  target: {
                    schema: args.schema || 'public',
                    table: args.table,
                  },
                }),
              },
            ],
          };
        }
      }
    );

    return server;
  }

  /**
   * Creates an Express router hosting the SSE MCP transport.
   */
  createRouter(): Router {
    const router = Router();

    // GET / - SSE endpoint for MCP clients (TrueForge)
    router.get('/', async (req, res) => {
      this.logger.info('MCP SSE client connecting...');
      try {
        const serverInstance = this.createMcpServerInstance();
        const transport = new SSEServerTransport(this.baseMessagePath, res);
        const sessionId = transport.sessionId;
        this.transports.set(sessionId, transport);

        req.on('close', () => {
          this.logger.info('MCP SSE client disconnected', { sessionId });
          this.transports.delete(sessionId);
          serverInstance.close().catch(() => {});
        });

        await serverInstance.connect(transport);
        this.logger.info('MCP server connected to SSE transport', { sessionId });
      } catch (err: unknown) {
        this.logger.error('Failed to establish MCP SSE transport', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to establish MCP SSE connection' });
        }
      }
    });

    // POST /messages - JSON-RPC message endpoint from MCP clients
    router.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing sessionId query parameter' });
        return;
      }

      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `MCP session not found for ID: ${sessionId}` });
        return;
      }

      try {
        await transport.handlePostMessage(req, res, req.body);
      } catch (err: unknown) {
        this.logger.error('Error handling MCP post message', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to process MCP message' });
        }
      }
    });

    // Health / Discovery endpoint
    router.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        name: 'schemasentry-mcp',
        version: '1.0.0',
        activeSessions: this.transports.size,
        tools: ['inspect_postgres_target'],
      });
    });

    return router;
  }

  /**
   * Direct handler for testing tool calls without full network transport.
   */
  getHandler(): InspectPostgresHandler {
    return this.handler;
  }
}
