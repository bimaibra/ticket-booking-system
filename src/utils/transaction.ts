import type { PrismaClient } from '../generated/prisma/client.js';
import { TransactionRetryExhaustedError, ConflictError } from './errors.js';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function withTransactionRetry<T>(
  prisma: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
  maxAttempts: number = 3,
): Promise<T> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`);
          return await fn(tx);
        },
        {
          timeout: 10000,
          maxWait: 5000,
        },
      );
    } catch (error: any) {
      const isRetryable =
        error.code === 'P2034' ||
        error.code === '40001' ||
        error.code === '40P01' ||
        (error.message &&
          (error.message.includes('40001') ||
            error.message.includes('40P01') ||
            error.message.includes('deadlock') ||
            error.message.includes('serialization failure')));

      if (isRetryable && attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, jitter));
        continue;
      }

      if (isRetryable && attempt >= maxAttempts) {
        throw new TransactionRetryExhaustedError();
      }

      if (error.code === '55P03' || (error.message && error.message.includes('55P03'))) {
        throw new ConflictError('Database lock timeout due to concurrent operations');
      }

      throw error;
    }
  }

  throw new TransactionRetryExhaustedError();
}
