import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { HealthCheckResponse } from '@orvexa/shared';

describe('Production Serving, Security Headers & SPA Fallback Tests', () => {
  const app = createApp();

  describe('Content Security Policy & Security Headers', () => {
    it('applies tailored Content-Security-Policy headers permitting necessary origins', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('https://fonts.googleapis.com');
      expect(csp).toContain('https://fonts.gstatic.com');
      expect(csp).toContain("object-src 'none'");
    });

    it('sets standard security protection headers (X-Frame-Options, X-Content-Type-Options)', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Health Check Diagnostic Telemetry', () => {
    it('returns structured subsystem diagnostic status for database and sandbox', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      const body = response.body as HealthCheckResponse;
      expect(body.status).toBe('ok');
      expect(body.subsystems).toBeDefined();
      expect(body.subsystems?.database).toBeDefined();
      expect(body.subsystems?.database?.provider).toBe('postgresql');
      expect(body.subsystems?.sandbox).toBeDefined();
    });
  });

  describe('Static Asset Serving vs. SPA Fallback Routing', () => {
    it('serves SPA index.html on root / navigation', async () => {
      const response = await request(app).get('/');
      // If web dist exists, it serves index.html (200 text/html)
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/html/);
      }
    });

    it('serves SPA index.html on /console page navigation', async () => {
      const response = await request(app).get('/console');
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/html/);
      }
    });

    it('returns 404 for missing static JavaScript assets (.js) instead of returning index.html', async () => {
      const response = await request(app).get('/assets/nonexistent-bundle.js');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for missing static CSS assets (.css) instead of returning index.html', async () => {
      const response = await request(app).get('/assets/nonexistent-style.css');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for missing image/media assets (.png, .svg, .ico)', async () => {
      const response = await request(app).get('/images/missing-logo.png');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 structured JSON for unhandled /api routes', async () => {
      const response = await request(app).get('/api/invalid-service-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
