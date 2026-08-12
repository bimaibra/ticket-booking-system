import { prisma } from '../lib/prisma.js';

export async function releaseExpiredHolds(): Promise<number> {
  const now = new Date();

  const result = await prisma.hold.updateMany({
    where: {
      status: 'ACTIVE',
      expires_at: {
        lt: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}

export async function cleanupExpiredIdempotencyRecords(): Promise<number> {
  const now = new Date();

  const result = await prisma.idempotencyRecord.deleteMany({
    where: {
      expires_at: {
        lt: now,
      },
    },
  });

  return result.count;
}