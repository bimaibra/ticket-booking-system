import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp } from '../helpers.js';

describe('Phase 6: Security and Operations Unit & Integration Tests', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars!';
    process.env.BCRYPT_ROUNDS = '12';
    process.env.AUTH_RATE_LIMIT_MAX = '5';

    db = await startTestDatabase();
    prisma = db.prisma;
    app = createTestApp(prisma);
  }, 120000);

  afterAll(async () => {
    if (db) {
      await stopTestDatabase(db);
    }
  });

  it('rate limits login attempts after max configured requests', async () => {
    await cleanDatabase(prisma);

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'wrongpassword' });
      expect([401, 400]).toContain(res.status);
    }

    const resOver = await request(app)
      .post('/auth/login')
      .send({ username: 'nonexistent', password: 'wrongpassword' });

    expect(resOver.status).toBe(429);
    expect(resOver.body.message).toContain('Too many authentication attempts');
  });

  it('GET /ready returns 200 when database is healthy', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('GET /metrics returns text snapshot of counter metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('assigns x-request-id header on every response', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });
});
