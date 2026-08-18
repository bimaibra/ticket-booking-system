import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp } from '../helpers.js';

describe('Auth Integration', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars!';
    process.env.BCRYPT_ROUNDS = '12';

    db = await startTestDatabase();
    prisma = db.prisma;
    app = createTestApp(prisma);
  }, 120000);

  afterAll(async () => {
    if (db) {
      await stopTestDatabase(db);
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('testuser');
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.role).toBe('USER');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        username: 'dupuser',
        name: 'First',
        email: 'first@example.com',
        password: 'SecurePass123!',
      });

    const res = await request(app)
      .post('/auth/register')
      .send({
        username: 'dupuser',
        name: 'Second',
        email: 'second@example.com',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Username already exists');
  });

  it('logs in and returns tokens', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        username: 'loginuser',
        name: 'Login User',
        email: 'login@example.com',
        password: 'SecurePass123!',
      });

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'loginuser', password: 'SecurePass123!' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user.username).toBe('loginuser');
  });

  it('refreshes tokens', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        username: 'refreshuser',
        name: 'Refresh User',
        email: 'refresh@example.com',
        password: 'SecurePass123!',
      });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ username: 'refreshuser', password: 'SecurePass123!' });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
  });

  it('logs out and invalidates refresh token', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        username: 'logoutuser',
        name: 'Logout User',
        email: 'logout@example.com',
        password: 'SecurePass123!',
      });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ username: 'logoutuser', password: 'SecurePass123!' });

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`);

    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token });

    expect(refreshRes.status).toBe(401);
  });
});


