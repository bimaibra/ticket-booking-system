import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';

export function createTestApp(prisma: PrismaClient) {
  return createApp({ prisma });
}

export async function dbFutureTime(prisma: PrismaClient, offsetMs: number): Promise<Date> {
  const rows = await prisma.$queryRawUnsafe<Array<{ t: Date }>>(
    `SELECT (clock_timestamp() + ($1::float * interval '1 millisecond')) AS t`,
    offsetMs,
  );
  return rows[0]!.t;
}