import type { Server } from 'node:http';
import { logger } from './logger.js';

export interface ShutdownTargets {
  server: Server | null;
  stopScheduler?: () => void;
  disconnect?: () => Promise<void>;
}

export function createGracefulShutdown(
  targets: ShutdownTargets,
  options: { drainTimeoutMs?: number } = {},
): (signal: string) => Promise<void> {
  const drainTimeout = options.drainTimeoutMs ?? 10000;

  return async function gracefulShutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Initiating graceful shutdown');

    targets.stopScheduler?.();

    const closePromise = new Promise<void>((resolve) => {
      if (targets.server) {
        targets.server.close(() => resolve());
      } else {
        resolve();
      }
    });

    await Promise.race([closePromise, new Promise<void>((resolve) => setTimeout(resolve, drainTimeout))]);
    await targets.disconnect?.();
    logger.info('Graceful shutdown completed');
  };
}