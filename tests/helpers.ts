import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';

export function createTestApp(prisma: PrismaClient) {
  return createApp({ prisma });
}