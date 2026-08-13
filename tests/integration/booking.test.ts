import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';

describe('Booking & Concurrency Integration', () => {
  let container: any;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let userToken: string;
  let adminToken: string;
  let userId: number;
  let ticketId: number;
  let eventId: number;

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

    const hashedPassword = await hashPassword('Password123!');
    const user = await prisma.user.create({
      data: {
        username: 'normaluser',
        name: 'Normal User',
        email: 'user@example.com',
        password_hash: hashedPassword,
        role: 'USER',
      },
    });

    const admin = await prisma.user.create({
      data: {
        username: 'adminuser',
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: hashedPassword,
        role: 'ADMIN',
      },
    });

    userId = user.id;
    userToken = signAccessToken({ sub: user.id, username: user.username, role: 'USER' });
    adminToken = signAccessToken({ sub: admin.id, username: admin.username, role: 'ADMIN' });

    const event = await prisma.event.create({
      data: {
        name: 'Concert 2026',
        event_date: new Date('2026-12-31'),
        description: 'Big Concert',
      },
    });
    eventId = event.id;

    const ticket = await prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'VIP',
        total_quota: 5,
        price: '150.00',
      },
    });
    ticketId = ticket.id;
  });

  it('creates hold successfully when quota available', async () => {
    const res = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.quantity).toBe(2);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('rejects hold creation when quota insufficient', async () => {
    const res = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 10 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Insufficient quota for hold');
  });

  it('converts active hold to order atomically', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 2 });

    const holdId = holdRes.body.id;

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'unique-key-101')
      .send({ hold_id: holdId });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.status).toBe('SUCCESS');
    expect(orderRes.body.order.details).toHaveLength(1);

    const checkHold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(checkHold?.status).toBe('CONSUMED');
    expect(checkHold?.order_id).toBe(orderRes.body.order.id);
  });

  it('returns cached response for duplicate idempotency key with same payload', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const holdId = holdRes.body.id;

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'idempotency-key-dup')
      .send({ hold_id: holdId });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'idempotency-key-dup')
      .send({ hold_id: holdId });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body).toEqual(res2.body);
  });

  it('returns 409 Conflict for duplicate idempotency key with different payload', async () => {
    const holdRes1 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const holdRes2 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'idempotency-key-mismatch')
      .send({ hold_id: holdRes1.body.id });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'idempotency-key-mismatch')
      .send({ hold_id: holdRes2.body.id });

    expect(res2.status).toBe(409);
    expect(res2.body.message).toContain('Idempotency key reused with different payload');
  });

  it('prevents overselling under concurrent hold creation', async () => {
    const requests = Array.from({ length: 10 }).map(() =>
      request(app)
        .post('/holds')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ticket_id: ticketId, quantity: 1 })
    );

    const responses = await Promise.all(requests);
    const successes = responses.filter((r) => r.status === 201);
    const failures = responses.filter((r) => r.status === 409);

    expect(successes.length).toBeLessThanOrEqual(5);
    expect(successes.length + failures.length).toBe(10);
  });
});
