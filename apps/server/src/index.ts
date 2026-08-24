import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.info(
    `[server] ${config.serviceName} v${config.version} running on http://localhost:${config.port}`
  );
  console.info(`[server] Health check available at http://localhost:${config.port}/api/health`);
});

const shutdown = (signal: string) => {
  console.info(`[server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.info('[server] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
