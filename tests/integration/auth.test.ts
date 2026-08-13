import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';

describe('Auth Integration', () => {
  let container: any;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionString = container.getConnectionUri();

    process.env.DATABASE_URL = connectionString;
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars!';
    process.env.BCRYPT_ROUNDS = '12';

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        refresh_token TEXT,
        role TEXT NOT NULL DEFAULT 'USER',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "Event" (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        event_date TIMESTAMP NOT NULL,
        description TEXT,
        address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "Ticket" (
        id SERIAL PRIMARY KEY,
        event_id INT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        total_quota INT NOT NULL,
        price DECIMAL(19,4) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "Hold" (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES "User"(id),
        ticket_id INT NOT NULL REFERENCES "Ticket"(id),
        order_id INT,
        quantity INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "Order" (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES "User"(id),
        total_amount DECIMAL(19,4) NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expired_at TIMESTAMP NOT NULL,
        idempotency_key TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS "OrderDetail" (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
        ticket_id INT NOT NULL REFERENCES "Ticket"(id),
        price DECIMAL(19,4) NOT NULL,
        quantity INT NOT NULL,
        subtotal DECIMAL(19,4) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        scope TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        response_body TEXT,
        status_code INT,
        state TEXT NOT NULL DEFAULT 'PENDING',
        user_id INT REFERENCES "User"(id) ON DELETE SET NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(key, scope)
      );
    `);

    app = createTestApp();
  }, 120000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.orderDetail.deleteMany();
    await prisma.order.deleteMany();
    await prisma.hold.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();
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
