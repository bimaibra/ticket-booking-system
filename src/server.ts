import 'dotenv/config';
import cron from 'node-cron';
import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './lib/prisma.js';
import { createApp } from './app.js';
import { releaseExpiredHolds, cleanupExpiredIdempotencyRecords } from './services/holdExpiry.js';

const app = createApp({ prisma });
const PORT = Number.parseInt(env.PORT, 10);

cron.schedule('*/30 * * * * *', async () => {
  try {
    const released = await releaseExpiredHolds(prisma);
    if (released > 0) {
      console.log(`Released ${released} expired holds`);
    }
    const cleaned = await cleanupExpiredIdempotencyRecords(prisma);
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired idempotency records`);
    }
  } catch (err) {
    console.error('Expiry cron error:', err);
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Dokumentasi API dapat diakses di http://localhost:${PORT}/docs`);
});

async function shutdown(): Promise<void> {
  server.close();
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);