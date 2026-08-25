import { Router } from 'express';
import { healthRouter } from './health.route.js';
import {
  migrationsRouter,
  createMigrationsRouter,
  type MigrationsRouterOptions,
} from './migrations.route.js';

export function createApiRouter(options?: MigrationsRouterOptions): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/migrations', options ? createMigrationsRouter(options) : migrationsRouter);
  return router;
}

export const apiRouter = createApiRouter();
