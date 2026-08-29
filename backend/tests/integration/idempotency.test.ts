import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp, dbFutureTime } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import crypto from 'node:crypto';

function uuidv4(): string {
  return crypto.randomUUID();
}

describe('Phase 4: Transactional Idempotency Integration', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let userToken: string;
  let userId: number;
  let ticketId: number;
  let eventId: number;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars!';
    process.env.BCRYPT_ROUNDS = '12';
    process.env.IDEMPOTENCY_TTL_SECONDS = '86400';

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
        username: 'idemuser',
        name: 'Idem User',
        email: 'idem@example.com',
        password_hash: hashedPassword,
        role: 'USER',
      },
    });

    userId = user.id;
    userToken = signAccessToken({ sub: user.id, username: user.username, role: 'USER' });

    const event = await prisma.event.create({
      data: {
        name: 'Idempotency Event',
        event_date: new Date('2026-12-31'),
      },
    });
    eventId = event.id;

    const ticket = await prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'Idem Ticket',
        total_quota: 10,
        price: '100.00',
      },
    });
    ticketId = ticket.id;
  });

  it('rejects non-UUID v4 idempotency key with 400', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ hold_ids: [holdRes.body.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('UUID v4');
  });

  it('simultaneous same-key same-payload requests return identical responses and one order', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const key = uuidv4();
    const payload = { hold_ids: [holdRes.body.id] };

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key)
        .send(payload),
      request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', key)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 201]);
    expect(res1.body).toEqual(res2.body);

    const orders = await prisma.order.findMany({ where: { user_id: userId } });
    expect(orders).toHaveLength(1);

    const records = await prisma.idempotencyRecord.findMany({
      where: { key, scope: 'POST /orders:v1' },
    });
    expect(records).toHaveLength(1);
    expect(records[0].state).toBe('COMPLETED');
    expect(records[0].status_code).toBe(201);
  });

  it('same-key different-payload returns 409 Conflict', async () => {
    const hold1 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const hold2 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const key = uuidv4();

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold1.body.id] });

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold2.body.id] });

    expect(res2.status).toBe(409);
    expect(res2.body.message).toContain('different payload');
  });

  it('reuses key after expiry without order-level uniqueness error', async () => {
    const hold1 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const key = uuidv4();

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold1.body.id] });

    expect(res1.status).toBe(201);

    await prisma.idempotencyRecord.updateMany({
      where: { key, scope: 'POST /orders:v1' },
      data: { expires_at: await dbFutureTime(prisma, -1000) },
    });

    const hold2 = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold2.body.id] });

    expect(res2.status).toBe(201);
    expect(res2.body.id).not.toBe(res1.body.id);

    const orders = await prisma.order.findMany({ where: { user_id: userId } });
    expect(orders).toHaveLength(2);
  });

  it('caches 410 HOLD_EXPIRED outcome for same key', async () => {
    const hold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: await dbFutureTime(prisma, -1000),
        status: 'ACTIVE',
      },
    });

    const key = uuidv4();

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.id] });

    expect(res1.status).toBe(410);

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.id] });

    expect(res2.status).toBe(410);

    const records = await prisma.idempotencyRecord.findMany({
      where: { key, scope: 'POST /orders:v1' },
    });
    expect(records).toHaveLength(1);
    expect(records[0].state).toBe('COMPLETED');
    expect(records[0].status_code).toBe(410);
  });

  it('does not cache non-201/non-410 outcomes and allows retry', async () => {
    const key = uuidv4();

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [999999] });

    expect(res1.status).toBe(404);

    const records = await prisma.idempotencyRecord.findMany({
      where: { key, scope: 'POST /orders:v1' },
    });
    expect(records).toHaveLength(0);

    const hold = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.body.id] });

    expect(res2.status).toBe(201);
  });

  it('rollback leaves no stranded PENDING claim and allows retry', async () => {
    const hold = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const key = uuidv4();

    await prisma.idempotencyRecord.create({
      data: {
        key,
        scope: 'POST /orders:v1',
        payload_hash: 'fake-hash',
        state: 'PENDING',
        user_id: userId,
        expires_at: await dbFutureTime(prisma, -10000),
      },
    });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.body.id] });

    expect(res.status).toBe(201);

    const records = await prisma.idempotencyRecord.findMany({
      where: { key, scope: 'POST /orders:v1' },
    });
    expect(records).toHaveLength(1);
    expect(records[0].state).toBe('COMPLETED');
    expect(records[0].status_code).toBe(201);
  });

  it('corrupt COMPLETED record fails closed with 500 and does not re-execute booking', async () => {
    const hold = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    const key = uuidv4();

    const res1 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.body.id] });

    expect(res1.status).toBe(201);

    await prisma.idempotencyRecord.update({
      where: { key_scope: { key, scope: 'POST /orders:v1' } },
      data: { response_body: '{invalid json' },
    });

    const res2 = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', key)
      .send({ hold_ids: [hold.body.id] });

    expect(res2.status).toBe(500);
    expect(res2.body.code).toBe('INTERNAL_ERROR');

    const orders = await prisma.order.findMany({ where: { user_id: userId } });
    expect(orders).toHaveLength(1);
  });
});
