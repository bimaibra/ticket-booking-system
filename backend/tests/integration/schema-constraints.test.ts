import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestDatabase, stopTestDatabase, type TestDatabase } from '../db.js';
import { verifyMigrationState } from '../../src/utils/migrationCheck.js';

describe('Schema Migration Verification & Direct Constraint Enforcement', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 120000);

  afterAll(async () => {
    if (db) {
      await stopTestDatabase(db);
    }
  });

  it('passes pg_catalog migration state verification', async () => {
    const report = await verifyMigrationState(db.prisma);
    expect(report.hasOrderDetailTicketIdx).toBe(true);
    expect(report.hasOrderHoldTable).toBe(true);
    expect(report.hasOrderHoldUniqueHoldIdx).toBe(true);
    expect(report.hasOrderHoldOrderIdx).toBe(true);
    expect(report.hasCheckConstraints).toBe(true);
    expect(report.hasIdempotencyStateEnum).toBe(true);
    expect(report.hasIdempotencyStateColumnEnum).toBe(true);
    expect(report.hasNoOrderIdempotencyKeyColumn).toBe(true);
    expect(report.hasNoHoldOrderIdColumn).toBe(true);
  });

  it('rejects direct invalid database writes via CHECK constraints', async () => {
    const user = await db.prisma.user.create({
      data: {
        username: 'schema_user',
        name: 'Schema User',
        email: 'schema@example.com',
        password_hash: 'hash',
      },
    });

    const event = await db.prisma.event.create({
      data: {
        name: 'Schema Event',
        event_date: new Date('2026-12-31'),
      },
    });

    // 1. Negative total_quota rejected
    await expect(
      db.prisma.$executeRawUnsafe(
        `INSERT INTO "Ticket" (event_id, name, total_quota, price, created_at, updated_at) VALUES (${event.id}, 'Invalid Quota', -5, 10.00, NOW(), NOW())`
      )
    ).rejects.toThrow(/Ticket_total_quota_positive/);

    // 2. Negative ticket price rejected
    await expect(
      db.prisma.$executeRawUnsafe(
        `INSERT INTO "Ticket" (event_id, name, total_quota, price, created_at, updated_at) VALUES (${event.id}, 'Invalid Price', 10, -50.00, NOW(), NOW())`
      )
    ).rejects.toThrow(/Ticket_price_nonneg/);

    const validTicket = await db.prisma.ticket.create({
      data: {
        event_id: event.id,
        name: 'Valid Ticket',
        total_quota: 10,
        price: '20.00',
      },
    });

    // 3. Non-positive hold quantity rejected
    await expect(
      db.prisma.$executeRawUnsafe(
        `INSERT INTO "Hold" (user_id, ticket_id, quantity, expires_at, status, created_at, updated_at) VALUES (${user.id}, ${validTicket.id}, 0, NOW(), 'ACTIVE', NOW(), NOW())`
      )
    ).rejects.toThrow(/Hold_quantity_positive/);

    // 4. Invalid status code rejected (< 100)
    await expect(
      db.prisma.$executeRawUnsafe(
        `INSERT INTO "IdempotencyRecord" (key, scope, payload_hash, state, status_code, expires_at, created_at, updated_at) VALUES ('key1', 'scope1', 'hash1', 'PENDING'::"IdempotencyState", 99, NOW(), NOW(), NOW())`
      )
    ).rejects.toThrow(/IdempotencyRecord_status_code_valid/);
  });
});
