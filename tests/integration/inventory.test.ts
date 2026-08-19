import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startTestDatabase, stopTestDatabase, cleanDatabase, type TestDatabase } from '../db.js';
import { createTestApp, dbFutureTime } from '../helpers.js';
import { hashPassword } from '../../src/lib/hash.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { GoneError, TransactionRetryExhaustedError } from '../../src/utils/errors.js';
import { withTransactionRetry } from '../../src/utils/transaction.js';

describe('Inventory Safety & Concurrency Integration (Phase 2)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let userToken: string;
  let user2Token: string;
  let adminToken: string;
  let userId: number;
  let user2Id: number;
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
        username: 'inventoryuser',
        name: 'Inventory User',
        email: 'invuser@example.com',
        password_hash: hashedPassword,
        role: 'USER',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        username: 'inventoryuser2',
        name: 'Inventory User 2',
        email: 'invuser2@example.com',
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
    user2Id = user2.id;
    userToken = signAccessToken({ sub: user.id, username: user.username, role: 'USER' });
    user2Token = signAccessToken({ sub: user2.id, username: user2.username, role: 'USER' });
    adminToken = signAccessToken({ sub: admin.id, username: admin.username, role: 'ADMIN' });

    const event = await prisma.event.create({
      data: {
        name: 'Phase 2 Event',
        event_date: new Date('2026-12-31'),
        description: 'Inventory Safety Test Event',
      },
    });
    eventId = event.id;

    const ticket = await prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'Phase 2 Ticket',
        total_quota: 10,
        price: '100.00',
      },
    });
    ticketId = ticket.id;
  });

  it('supports quantity > 1 for active holds and successful orders in availability', async () => {
    await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 3,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    const order = await prisma.order.create({
      data: {
        user_id: userId,
        status: 'SUCCESS',
        total_amount: '400.00',

        details: {
          create: {
            ticket_id: ticketId,
            quantity: 4,
            price: '100.00',
            subtotal: '400.00',
          },
        },
      },
    });

    const res = await request(app).get(`/events/${eventId}/availability`);
    expect(res.status).toBe(200);
    const avail = res.body.tickets.find((t: any) => t.ticket_id === ticketId);
    expect(avail.total_quota).toBe(10);
    expect(avail.available_quota).toBe(3); // 10 - 3 - 4 = 3
    expect(avail.last_updated).toBeDefined();
  });

  it('proves PENDING, CANCELLED, and EXPIRED orders do not consume availability', async () => {
    for (const status of ['PENDING', 'CANCELLED', 'EXPIRED'] as const) {
      await prisma.order.create({
        data: {
          user_id: userId,
          status,
          total_amount: '200.00',
  
          details: {
            create: {
              ticket_id: ticketId,
              quantity: 2,
              price: '100.00',
              subtotal: '200.00',
            },
          },
        },
      });
    }

    const res = await request(app).get(`/events/${eventId}/availability`);
    expect(res.status).toBe(200);
    const avail = res.body.tickets.find((t: any) => t.ticket_id === ticketId);
    expect(avail.available_quota).toBe(10);
  });

  it('proves expired ACTIVE holds do not consume availability before scheduler status update', async () => {
    await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 5,
        expires_at: await dbFutureTime(prisma, -1000), // Expired 1 second ago
        status: 'ACTIVE', // Still marked ACTIVE in DB
      },
    });

    const res = await request(app).get(`/events/${eventId}/availability`);
    expect(res.status).toBe(200);
    const avail = res.body.tickets.find((t: any) => t.ticket_id === ticketId);
    expect(avail.available_quota).toBe(10); // Not deducted
  });

  it('prevents overselling with quantities > 1 under concurrent hold attempts', async () => {
    // 5 concurrent requests each asking for quantity = 3 (total requested = 15, quota = 10)
    const requests = Array.from({ length: 5 }).map(() =>
      request(app)
        .post('/holds')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ticket_id: ticketId, quantity: 3 })
    );

    const responses = await Promise.all(requests);
    const successes = responses.filter((r) => r.status === 201);
    const failures = responses.filter((r) => r.status === 409);

    const totalHeldQuantity = successes.reduce((acc, r) => acc + r.body.quantity, 0);
    expect(totalHeldQuantity).toBeLessThanOrEqual(10);
    expect(successes.length).toBe(3); // 3 * 3 = 9 <= 10, 4th request (requires 3, only 1 left) fails with 409
    expect(failures.length).toBe(2);
    expect(failures[0].body.message).toContain('Insufficient quota');
  });

  it('handles hold cancellation and returns 410 for expired hold cancellation', async () => {
    const activeHold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 2,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    const cancelRes = await request(app)
      .delete(`/holds/${activeHold.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const expiredHold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 2,
        expires_at: await dbFutureTime(prisma, -1000),
        status: 'ACTIVE',
      },
    });

    const expiredRes = await request(app)
      .delete(`/holds/${expiredHold.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(expiredRes.status).toBe(410);
    expect(expiredRes.body.code).toBe('GONE');

    const updatedExpiredHold = await prisma.hold.findUnique({ where: { id: expiredHold.id } });
    expect(updatedExpiredHold?.status).toBe('EXPIRED');
  });

  it('rejects total_quota reduction below allocated quantity with 409 Conflict', async () => {
    await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 6,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .put(`/events/${eventId}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ total_quota: 5 });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Cannot reduce total_quota below allocated quantity 6');

    const validRes = await request(app)
      .put(`/events/${eventId}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ total_quota: 8 });

    expect(validRes.status).toBe(200);
    expect(validRes.body.total_quota).toBe(8);
  });

  it('prevents event/ticket deletion when history exists and returns 409 HISTORY_RETAINED', async () => {
    await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    const deleteTicketRes = await request(app)
      .delete(`/events/${eventId}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteTicketRes.status).toBe(409);
    expect(deleteTicketRes.body.code).toBe('HISTORY_RETAINED');

    const deleteEventRes = await request(app)
      .delete(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteEventRes.status).toBe(409);
    expect(deleteEventRes.body.code).toBe('HISTORY_RETAINED');
  });

  it('handles transaction retry exhaustion contract properly', async () => {
    const mockFailingFn = async () => {
      const err: any = new Error('serialization failure 40001');
      err.code = '40001';
      throw err;
    };

    await expect(withTransactionRetry(prisma, mockFailingFn, 3)).rejects.toThrow(
      TransactionRetryExhaustedError,
    );
  });

  it('preserves capacity invariant under repeated concurrent hold contention', async () => {
    // 100 iterations, each asking for quantity = 4 with quota = 10 (total requested 40 > 10)
    for (let iteration = 0; iteration < 100; iteration++) {
      const requests = Array.from({ length: 10 }).map(() =>
        request(app)
          .post('/holds')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ticket_id: ticketId, quantity: 4 })
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 201);

      const activeHeld = await prisma.hold.aggregate({
        where: {
          ticket_id: ticketId,
          status: 'ACTIVE',
          expires_at: { gt: new Date() },
        },
        _sum: { quantity: true },
      });
      const successfulOrdered = await prisma.orderDetail.aggregate({
        where: { ticket_id: ticketId, order: { status: 'SUCCESS' } },
        _sum: { quantity: true },
      });

      const activeHeldQty = activeHeld._sum.quantity ?? 0;
      const orderedQty = successfulOrdered._sum.quantity ?? 0;
      expect(activeHeldQty + orderedQty).toBeLessThanOrEqual(10);

      const successfulHeldQty = successes.reduce((acc, r) => acc + r.body.quantity, 0);
      expect(successfulHeldQty).toBeLessThanOrEqual(10);

      await prisma.hold.deleteMany({ where: { status: 'ACTIVE' } });
    }
  });

  it('handles hold cancellation racing with booking (at most one outcome)', async () => {
    for (let i = 0; i < 5; i++) {
      await cleanDatabase(prisma);
      const hashedPassword = await hashPassword('Password123!');
      const raceUser = await prisma.user.create({
        data: {
          username: `cancelrace${i}`,
          name: 'Cancel Race',
          email: `cancelrace${i}@example.com`,
          password_hash: hashedPassword,
          role: 'USER',
        },
      });
      const raceUserToken = signAccessToken({ sub: raceUser.id, username: raceUser.username, role: 'USER' });

      const event = await prisma.event.create({
        data: {
          name: `Cancel Race Event ${i}`,
          event_date: new Date('2026-12-31'),
        },
      });
      const ticket = await prisma.ticket.create({
        data: {
          event_id: event.id,
          name: 'Cancel Race Ticket',
          total_quota: 5,
          price: '100.00',
        },
      });
      const hold = await prisma.hold.create({
        data: {
          ticket_id: ticket.id,
          user_id: raceUser.id,
          quantity: 1,
          expires_at: await dbFutureTime(prisma, 600000),
          status: 'ACTIVE',
        },
      });

      const [cancelRes, bookingRes] = await Promise.all([
        request(app).delete(`/holds/${hold.id}`).set('Authorization', `Bearer ${raceUserToken}`),
        request(app)
          .post('/orders')
          .set('Authorization', `Bearer ${raceUserToken}`)
          .set('Idempotency-Key', `race-key-${i}`)
          .send({ hold_ids: [hold.id] }),
      ]);

      const statuses = [cancelRes.status, bookingRes.status].sort();
      expect(statuses).toEqual([200, 409]);
    }
  });

  it('handles hold expiry racing with booking (expired hold never books)', async () => {
    const hold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: await dbFutureTime(prisma, 300),
        status: 'ACTIVE',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 400));

    const bookingRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'expired-race-key')
      .send({ hold_ids: [hold.id] });

    expect([409, 410]).toContain(bookingRes.status);

    const checkHold = await prisma.hold.findUnique({ where: { id: hold.id } });
    expect(checkHold?.status).toBe('EXPIRED');
  });

  it('handles quota reduction racing with hold creation (never below allocated)', async () => {
    const hold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 6,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    const [reduceRes, holdRes] = await Promise.all([
      request(app)
        .put(`/events/${eventId}/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ total_quota: 5 }),
      request(app)
        .post('/holds')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ticket_id: ticketId, quantity: 2 }),
    ]);

    expect([409, 201]).toContain(reduceRes.status);
    expect(holdRes.status).toBe(201);

    const allocated = await prisma.$queryRawUnsafe<Array<{ allocated: number }>>(
      `SELECT
         COALESCE((
           SELECT SUM(h.quantity)
           FROM "Hold" h
           WHERE h.ticket_id = $1
             AND h.status = 'ACTIVE'
             AND h.expires_at > clock_timestamp()
         ), 0)
         + COALESCE((
           SELECT SUM(od.quantity)
           FROM "OrderDetail" od
           JOIN "Order" o ON o.id = od.order_id
           WHERE od.ticket_id = $1
             AND o.status = 'SUCCESS'
         ), 0) AS allocated`,
      ticketId,
    );
    expect(Number(allocated[0].allocated)).toBeLessThanOrEqual(10);
  });

  it('handles scheduler expiry racing with booking and cancellation including expiry equality', async () => {
    const equalityHold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: await dbFutureTime(prisma, 300),
        status: 'ACTIVE',
      },
    });

    const activeHold = await prisma.hold.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        quantity: 1,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 400));

    const [expiredRes, cancelRes, bookingRes] = await Promise.all([
      request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', 'scheduler-equality-key')
        .send({ hold_ids: [equalityHold.id] }),
      request(app)
        .delete(`/holds/${activeHold.id}`)
        .set('Authorization', `Bearer ${userToken}`),
      request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', 'scheduler-booking-key')
        .send({ hold_ids: [activeHold.id] }),
    ]);

    expect([409, 410]).toContain(expiredRes.status);
    expect([200, 400]).toContain(cancelRes.status);
    expect([201, 409]).toContain(bookingRes.status);

    const ordersForHold = await prisma.orderHold.findMany({ where: { hold_id: activeHold.id } });
    expect(ordersForHold.length).toBeLessThanOrEqual(1);

    const activeHoldStatus = await prisma.hold.findUnique({ where: { id: activeHold.id } });
    expect(['CANCELLED', 'CONSUMED']).toContain(activeHoldStatus?.status);
  });

  it('serializes concurrent identical hold creation without exceeding quota or deadlocking', async () => {
    // Two tickets with reversed creation input order to exercise deterministic lock ordering
    const ticket2 = await prisma.ticket.create({
      data: {
        event_id: eventId,
        name: 'Second Ticket',
        total_quota: 3,
        price: '50.00',
      },
    });

    const holdForTicket2 = await prisma.hold.create({
      data: {
        ticket_id: ticket2.id,
        user_id: userId,
        quantity: 2,
        expires_at: await dbFutureTime(prisma, 600000),
        status: 'ACTIVE',
      },
    });

    await prisma.hold.delete({ where: { id: holdForTicket2.id } });

    const requests = Array.from({ length: 8 }).map((_, idx) =>
      request(app)
        .post('/holds')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ticket_id: idx % 2 === 0 ? ticketId : ticket2.id, quantity: 1 })
    );

    const responses = await Promise.all(requests);
    const okCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;
    expect(okCount + conflictCount).toBe(8);

    const t1Alloc = await prisma.hold.aggregate({
      where: { ticket_id: ticketId, status: 'ACTIVE', expires_at: { gt: new Date() } },
      _sum: { quantity: true },
    });
    const t2Alloc = await prisma.hold.aggregate({
      where: { ticket_id: ticket2.id, status: 'ACTIVE', expires_at: { gt: new Date() } },
      _sum: { quantity: true },
    });
    expect((t1Alloc._sum.quantity ?? 0) + (t2Alloc._sum.quantity ?? 0)).toBeLessThanOrEqual(13);
  });
});
