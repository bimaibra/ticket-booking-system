import 'dotenv/config';
import cron from 'node-cron';
import type { Server } from 'node:http';
import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './lib/prisma.js';
import { createApp } from './app.js';
import { releaseExpiredHolds, cleanupExpiredIdempotencyRecords } from './services/holdExpiry.js';
import { logger } from './lib/logger.js';
import { createGracefulShutdown } from './lib/shutdown.js';

const app = createApp({ prisma });
const PORT = env.PORT;

const ADVISORY_LOCK_KEY = '8372648172948102938';

let isShuttingDown = false;
let cronTask: cron.ScheduledTask | null = null;
let server: Server | null = null;

cronTask = cron.schedule('*/30 * * * * *', async () => {
  if (isShuttingDown) return;
  const startTime = Date.now();

  try {
    await prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
          `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
          ADVISORY_LOCK_KEY,
        );

        if (!lockRows[0]?.locked) {
          logger.debug({ event: 'scheduler_lock_miss' }, 'Advisory lock skipped by concurrent instance');
          return;
        }

        const released = await releaseExpiredHolds(tx as any);
        const cleaned = await cleanupExpiredIdempotencyRecords(tx as any);

        logger.info(
          {
            event: 'scheduler_cycle_completed',
            duration_ms: Date.now() - startTime,
            released_holds: released,
            cleaned_idempotency: cleaned,
          },
          'Scheduler cycle executed cleanly with advisory lock',
        );
      },
      { timeout: 25000, maxWait: 5000 },
    );
  } catch (err) {
    logger.error({ err, duration_ms: Date.now() - startTime }, 'Expiry cron error');
  }
});

server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running at http://localhost:${PORT}`);
});

const handleShutdown = createGracefulShutdown({
  server,
  stopScheduler: () => {
    isShuttingDown = true;
    cronTask?.stop();
  },
  disconnect: disconnectPrisma,
});

process.on('SIGTERM', () => {
  handleShutdown('SIGTERM').then(() => process.exit(0)).catch(() => process.exit(1));
});
process.on('SIGINT', () => {
  handleShutdown('SIGINT').then(() => process.exit(0)).catch(() => process.exit(1));
});