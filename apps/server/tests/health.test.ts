import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { HealthCheckResponse } from '@orvexa/shared';

describe('Health Check API Endpoint', () => {
  const app = createApp();

  it('GET /api/health returns 200 OK and valid health payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);

    const body = response.body as HealthCheckResponse;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('orvexa-backend');
    expect(body.version).toBe('0.1.0');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('GET /unknown returns 404 with structured error', async () => {
    const response = await request(app).get('/api/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
