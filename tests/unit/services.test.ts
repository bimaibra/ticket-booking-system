import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  ticket: {
    findMany: vi.fn(),
  },
  hold: {
    updateMany: vi.fn(),
  },
  idempotencyRecord: {
    deleteMany: vi.fn(),
  },
};

import { getTicketAvailability, getEventAvailability } from '../../src/services/availability.js';
import { releaseExpiredHolds, cleanupExpiredIdempotencyRecords } from '../../src/services/holdExpiry.js';
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

    mockPrisma.ticket.findMany.mockResolvedValue(mockTickets as any);

    const result = await getTicketAvailability(mockPrisma as any, 1);

    expect(result).toHaveLength(1);
    expect(result[0].ticket_id).toBe(1);
    expect(result[0].total_quota).toBe(50);
    expect(result[0].available_quota).toBe(45);
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

    mockPrisma.ticket.findMany.mockResolvedValue(mockTickets as any);

    const result = await getEventAvailability(mockPrisma as any, 1);

    expect(result[0].available_quota).toBe(0);
  });
});

describe('Hold & Idempotency Expiry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releaseExpiredHolds updates ACTIVE holds with past expires_at', async () => {
    mockPrisma.hold.updateMany.mockResolvedValue({ count: 5 });

    const count = await releaseExpiredHolds(mockPrisma as any);

    expect(count).toBe(5);
    expect(mockPrisma.hold.updateMany).toHaveBeenCalledWith({
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
    mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 12 });

    const count = await cleanupExpiredIdempotencyRecords(mockPrisma as any);

    expect(count).toBe(12);
    expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        expires_at: {
          lt: expect.any(Date),
        },
      },
    });
  });
});


