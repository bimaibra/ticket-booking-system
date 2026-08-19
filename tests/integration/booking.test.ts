import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';

describe('Booking & Concurrency Integration', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let userToken: string;
  let adminToken: string;
  let userId: number;
  let ticketId: number;
  let eventId: number;

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

    const checkOrderHold = await prisma.orderHold.findUnique({ where: { hold_id: holdId } });
    expect(checkOrderHold?.order_id).toBe(orderRes.body.order.id);
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
</content>