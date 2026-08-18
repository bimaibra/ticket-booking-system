import { describe, it, expect, afterAll } from 'vitest';
import { startTestDatabase, stopTestDatabase, type TestDatabase } from '../db.js';

describe('Migration Smoke Test', () => {
  let db: TestDatabase;

  afterAll(async () => {
    if (db) {
      await stopTestDatabase(db);
    }
  });

  it('applies migrations to an empty database and supports write/read flow', async () => {
    db = await startTestDatabase();

    const user = await db.prisma.user.create({
      data: {
        username: 'smoke_user',
        name: 'Smoke User',
        email: 'smoke@example.com',
        password_hash: 'hashed',
        role: 'USER',
      },
    });
    expect(user.id).toBeGreaterThan(0);

    const event = await db.prisma.event.create({
      data: {
        name: 'Smoke Event',
        event_date: new Date('2026-12-31'),
      },
    });
    expect(event.id).toBeGreaterThan(0);

    const ticket = await db.prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'General',
        total_quota: 100,
        price: '25.00',
      },
    });
    expect(ticket.id).toBeGreaterThan(0);

    const hold = await db.prisma.hold.create({
      data: {
        user_id: user.id,
        ticket_id: ticket.id,
        quantity: 2,
        expires_at: new Date(Date.now() + 600000),
        status: 'ACTIVE',
      },
    });
    expect(hold.status).toBe('ACTIVE');

    const order = await db.prisma.order.create({
      data: {
        user_id: user.id,
        total_amount: '50.00',
        status: 'SUCCESS',
        expired_at: new Date(Date.now() + 900000),
        details: {
          create: {
            ticket_id: ticket.id,
            quantity: 2,
            price: '25.00',
            subtotal: '50.00',
          },
        },
      },
      include: { details: true },
    });
    expect(order.details).toHaveLength(1);

    const idempotencyRecord = await db.prisma.idempotencyRecord.create({
      data: {
        key: 'smoke-key',
        scope: 'POST /orders:v1',
        payload_hash: 'abc123',
        state: 'COMPLETED',
        status_code: 201,
        response_body: '{"ok":true}',
        user_id: user.id,
        expires_at: new Date(Date.now() + 86400000),
      },
    });
    expect(idempotencyRecord.key).toBe('smoke-key');
  }, 120000);
});