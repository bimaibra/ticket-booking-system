import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp, dbFutureTime } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';

describe('Phase 7: Admin, Event, and Ticket CRUD Coverage', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let adminToken: string;
  let userToken: string;
  let userId: number;

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
    const admin = await prisma.user.create({
      data: {
        username: 'crudadmin',
        name: 'Crud Admin',
        email: 'crudadmin@example.com',
        password_hash: hashedPassword,
        role: 'ADMIN',
      },
    });
    const user = await prisma.user.create({
      data: {
        username: 'cruduser',
        name: 'Crud User',
        email: 'cruduser@example.com',
        password_hash: hashedPassword,
        role: 'USER',
      },
    });

    userId = user.id;
    adminToken = signAccessToken({ sub: admin.id, username: admin.username, role: 'ADMIN' });
    userToken = signAccessToken({ sub: user.id, username: user.username, role: 'USER' });
  });

  it('lists events and returns a single event by id', async () => {
    const created = await prisma.event.create({
      data: { name: 'Listable Event', event_date: new Date('2027-01-01') },
    });

    const listRes = await request(app).get('/events');
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((e: any) => e.id === created.id)).toBe(true);

    const singleRes = await request(app).get(`/events/${created.id}`);
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.name).toBe('Listable Event');
  });

  it('returns 404 and validation errors for event lookups', async () => {
    const missing = await request(app).get('/events/999999');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');

    const invalid = await request(app).get('/events/not-a-number');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates, updates (PUT/PATCH), and deletes an event as admin', async () => {
    const createRes = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Event', event_date: '2027-06-01T00:00:00.000Z' });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;

    const putRes = await request(app)
      .put(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Event' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe('Updated Event');

    const patchRes = await request(app)
      .patch(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Patched description' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.description).toBe('Patched description');

    const deleteRes = await request(app)
      .delete(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const gone = await request(app).get(`/events/${eventId}`);
    expect(gone.status).toBe(404);
  });

  it('rejects event mutation validation errors and forbidden users', async () => {
    const invalidCreate = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', event_date: 'not-a-date' });
    expect(invalidCreate.status).toBe(400);

    const created = await prisma.event.create({
      data: { name: 'Forbidden Event', event_date: new Date('2027-01-01') },
    });

    const forbiddenPut = await request(app)
      .put(`/events/${created.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Nope' });
    expect(forbiddenPut.status).toBe(403);

    const unauthenticated = await request(app).delete(`/events/${created.id}`);
    expect(unauthenticated.status).toBe(401);

    const missingPut = await request(app)
      .put('/events/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nope' });
    expect(missingPut.status).toBe(404);
  });

  it('returns availability for an event with held tickets', async () => {
    const event = await prisma.event.create({
      data: { name: 'Avail Event', event_date: new Date('2027-01-01') },
    });
    const ticket = await prisma.ticket.create({
      data: { event_id: event.id, name: 'GA', total_quota: 5, price: '25.00' },
    });
    await prisma.hold.create({
      data: { ticket_id: ticket.id, user_id: userId, quantity: 2, status: 'ACTIVE', expires_at: await dbFutureTime(prisma, 600000) },
    });

    const res = await request(app).get(`/events/${event.id}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.find((t: any) => t.ticket_id === ticket.id).available_quota).toBe(3);
    expect(res.body.tickets[0].last_updated).toBeDefined();
  });

  it('creates, updates, and deletes a history-free ticket as admin', async () => {
    const event = await prisma.event.create({
      data: { name: 'Ticket Event', event_date: new Date('2027-01-01') },
    });

    const createRes = await request(app)
      .post(`/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'VIP', total_quota: 10, price: '99.00' });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.id;

    const putRes = await request(app)
      .put(`/events/${event.id}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '119.00' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.price.toString()).toBe('119');

    const patchRes = await request(app)
      .patch(`/events/${event.id}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ total_quota: 20 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.total_quota).toBe(20);

    const deleteRes = await request(app)
      .delete(`/events/${event.id}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);
  });

  it('returns contract errors for ticket operations', async () => {
    const event = await prisma.event.create({
      data: { name: 'Err Event', event_date: new Date('2027-01-01') },
    });

    const forbidden = await request(app)
      .post(`/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'VIP', total_quota: 1, price: '10.00' });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .post(`/events/${event.id}/tickets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'VIP', total_quota: -1, price: 'abc' });
    expect(invalid.status).toBe(400);

    const missingTicket = await request(app)
      .put(`/events/${event.id}/tickets/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '10.00' });
    expect(missingTicket.status).toBe(404);

    const invalidIds = await request(app)
      .put('/events/not-a-number/tickets/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: '10.00' });
    expect(invalidIds.status).toBe(400);
  });

  it('lists admin orders and users and updates a role', async () => {
    const event = await prisma.event.create({
      data: { name: 'Admin Event', event_date: new Date('2027-01-01') },
    });
    const ticket = await prisma.ticket.create({
      data: { event_id: event.id, name: 'GA', total_quota: 10, price: '50.00' },
    });
    await prisma.order.create({
      data: {
        user_id: userId,
        status: 'SUCCESS',
        total_amount: '50.00',
        details: { create: { ticket_id: ticket.id, quantity: 1, price: '50.00', subtotal: '50.00' } },
      },
    });

    const ordersRes = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body.length).toBe(1);

    const usersRes = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.length).toBe(2);
    expect(usersRes.body[0].password_hash).toBeUndefined();

    const roleRes = await request(app)
      .patch(`/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.role).toBe('ADMIN');

    const missingUser = await request(app)
      .patch('/admin/users/999999/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'USER' });
    expect(missingUser.status).toBe(404);

    const invalidRole = await request(app)
      .patch(`/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUPERUSER' });
    expect(invalidRole.status).toBe(400);

    const invalidUserId = await request(app)
      .patch('/admin/users/abc/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'USER' });
    expect(invalidUserId.status).toBe(400);

    const forbidden = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);
  });
});
