import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import crypto from 'node:crypto';

function uuidv4(): string {
  return crypto.randomUUID();
}

describe('Phase 5: Runtime and OpenAPI Contract Alignment', () => {
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
        username: 'contractuser',
        name: 'Contract User',
        email: 'contract@example.com',
        password_hash: hashedPassword,
        role: 'USER',
      },
    });

    const admin = await prisma.user.create({
      data: {
        username: 'contractadmin',
        name: 'Contract Admin',
        email: 'contractadmin@example.com',
        password_hash: hashedPassword,
        role: 'ADMIN',
      },
    });

    userId = user.id;
    userToken = signAccessToken({ sub: user.id, username: user.username, role: 'USER' });
    adminToken = signAccessToken({ sub: admin.id, username: admin.username, role: 'ADMIN' });

    const event = await prisma.event.create({
      data: {
        name: 'Contract Event',
        event_date: new Date('2026-12-31'),
      },
    });
    eventId = event.id;

    const ticket = await prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'Contract Ticket',
        total_quota: 10,
        price: '50.00',
      },
    });
    ticketId = ticket.id;
  });

  it('GET /events/{id}/tickets returns available_quota and last_updated', async () => {
    const res = await request(app).get(`/events/${eventId}/tickets`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const t = res.body.find((x: any) => x.id === ticketId);
    expect(t).toBeDefined();
    expect(t.available_quota).toBe(10);
    expect(t.last_updated).toBeDefined();
    expect(t.price).toBe('50.00');
  });

  it('GET /events/{id}/availability returns same available_quota as ticket listing', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 3 });
    expect(holdRes.status).toBe(201);

    const ticketsRes = await request(app).get(`/events/${eventId}/tickets`);
    const availRes = await request(app).get(`/events/${eventId}/availability`);

    const ticketAvail = ticketsRes.body.find((x: any) => x.id === ticketId).available_quota;
    const dedicatedAvail = availRes.body.tickets.find((x: any) => x.ticket_id === ticketId).available_quota;
    expect(ticketAvail).toBe(7);
    expect(dedicatedAvail).toBe(7);
  });

  it('POST /orders requires UUID v4 Idempotency-Key', async () => {
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

  it('POST /orders accepts hold_ids array and returns bare Order', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 2 });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({ hold_ids: [holdRes.body.id] });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.details).toBeDefined();
    expect(res.body.total_amount).toBe('100.00');
    expect(res.body.expired_at).toBeUndefined();
    expect(res.body.idempotency_key).toBeUndefined();
  });

  it('POST /orders returns 410 for expired holds', async () => {
    const hold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: new Date(Date.now() - 1000),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({ hold_ids: [hold.id] });

    expect(res.status).toBe(410);
    expect(res.body.code).toBe('GONE');
  });

  it('DELETE /events/{id} returns 409 HISTORY_RETAINED when holds exist', async () => {
    await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: new Date(Date.now() + 600000),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .delete(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HISTORY_RETAINED');
  });

  it('DELETE /events/{eventId}/tickets/{ticketId} returns 409 HISTORY_RETAINED when order exists', async () => {
    const holdRes = await request(app)
      .post('/holds')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticket_id: ticketId, quantity: 1 });

    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({ hold_ids: [holdRes.body.id] });

    const res = await request(app)
      .delete(`/events/${eventId}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HISTORY_RETAINED');
  });

  it('/orders/{id}/confirm does not exist', async () => {
    const res = await request(app)
      .post('/orders/1/confirm')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /health returns liveness', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
