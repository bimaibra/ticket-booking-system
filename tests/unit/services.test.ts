import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => {
  return {
    prisma: {
      ticket: {
        findMany: vi.fn(),
      },
      hold: {
        updateMany: vi.fn(),
      },
      idempotencyRecord: {
        deleteMany: vi.fn(),
      },
    },
  };
});

import { getTicketAvailability, getEventAvailability } from '../../src/services/availability.js';
import { releaseExpiredHolds, cleanupExpiredIdempotencyRecords } from '../../src/services/holdExpiry.js';
import { prisma } from '../../src/lib/prisma.js';
import { Prisma } from '../../src/generated/prisma/client.js';

describe('Availability Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates available quota correctly considering confirmed orders and active holds', async () => {
    const mockTickets = [
      {
        id: 1,
        name: 'VIP Ticket',
        price: new Prisma.Decimal('100.00'),
        total_quota: 50,
        orderDetails: [{ order_id: 101 }, { order_id: 102 }],
        holds: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    ];

    vi.mocked(prisma.ticket.findMany).mockResolvedValue(mockTickets as any);

    const result = await getTicketAvailability(1);

    expect(result).toHaveLength(1);
    expect(result[0].ticket_id).toBe(1);
    expect(result[0].total_quota).toBe(50);
    expect(result[0].available_quota).toBe(45); // 50 - 2 confirmed - 3 holds
    expect(result[0].price).toBe('100');
  });

  it('clamps available_quota to 0 if holds/orders exceed total quota', async () => {
    const mockTickets = [
      {
        id: 2,
        name: 'Standard Ticket',
        price: new Prisma.Decimal('50.00'),
        total_quota: 2,
        orderDetails: [{ order_id: 101 }, { order_id: 102 }],
        holds: [{ id: 1 }],
      },
    ];

    vi.mocked(prisma.ticket.findMany).mockResolvedValue(mockTickets as any);

    const result = await getEventAvailability(1);

    expect(result[0].available_quota).toBe(0);
  });
});

describe('Hold & Idempotency Expiry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releaseExpiredHolds updates ACTIVE holds with past expires_at', async () => {
    vi.mocked(prisma.hold.updateMany).mockResolvedValue({ count: 5 });

    const count = await releaseExpiredHolds();

    expect(count).toBe(5);
    expect(prisma.hold.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        expires_at: {
          lt: expect.any(Date),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  });

  it('cleanupExpiredIdempotencyRecords deletes expired records', async () => {
    vi.mocked(prisma.idempotencyRecord.deleteMany).mockResolvedValue({ count: 12 });

    const count = await cleanupExpiredIdempotencyRecords();

    expect(count).toBe(12);
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        expires_at: {
          lt: expect.any(Date),
        },
      },
    });
  });
});
