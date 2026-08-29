import type { PrismaClient } from '../generated/prisma/client.js';

async function dbNow(prisma: PrismaClient): Promise<Date> {
  const rows = await prisma.$queryRawUnsafe<Array<{ t: Date }>>(`SELECT clock_timestamp() AS t`);
  return rows[0]?.t ? new Date(rows[0].t) : new Date();
}

export async function releaseExpiredHolds(prisma: PrismaClient): Promise<number> {
  const now = await dbNow(prisma);

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

export async function cleanupExpiredIdempotencyRecords(prisma: PrismaClient): Promise<number> {
  const now = await dbNow(prisma);

  const result = await prisma.idempotencyRecord.deleteMany({
    where: {
      expires_at: {
        lt: now,
      },
    },
  });

  return result.count;
}
