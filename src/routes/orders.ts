import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError, GoneError, AppError } from '../utils/errors.js';
import { withTransactionRetry } from '../utils/transaction.js';
import { env } from '../config/env.js';
import { meterBookingOutcome, meterIdempotencyOutcome } from '../lib/metrics.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createOrderSchema = z.object({
  hold_ids: z
    .array(z.number().int().positive())
    .min(1, 'hold_ids array must contain at least 1 hold ID')
    .max(100, 'hold_ids array must contain at most 100 hold IDs')
    .refine((items) => new Set(items).size === items.length, {
      message: 'hold_ids array must contain unique positive integers',
    }),
});

const SCOPE = 'POST /orders:v1';
const HOLD_EXPIRED_RESULT = Symbol('HOLD_EXPIRED');

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function formatOrderResponse(order: any) {
  return {
    id: order.id,
    user_id: order.user_id,
    total_amount: order.total_amount.toString(),
    status: order.status,
    created_at: order.created_at instanceof Date ? order.created_at.toISOString() : order.created_at,
    updated_at: order.updated_at instanceof Date ? order.updated_at.toISOString() : order.updated_at,
    details: (order.details || []).map((d: any) => ({
      id: d.id,
      order_id: d.order_id,
      ticket_id: d.ticket_id,
      price: d.price.toString(),
      quantity: d.quantity,
      subtotal: d.subtotal.toString(),
    })),
  };
}

export function createOrdersRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/orders', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new ValidationError('Idempotency-Key header required');
    }

    if (!UUID_V4_REGEX.test(idempotencyKey)) {
      throw new ValidationError('Idempotency-Key header must be a valid UUID v4');
    }

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { hold_ids } = parsed.data;
    const sortedHoldIds = [...hold_ids].sort((a, b) => a - b);
    const canonicalPayload = { version: 1, hold_ids: sortedHoldIds };
    const payloadHash = hashPayload(canonicalPayload);

    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const orderResult = await withTransactionRetry(prisma, async (tx) => {
          const evalResult = await tx.$queryRawUnsafe<Array<{ eval_time: Date }>>(
            `SELECT clock_timestamp() AS eval_time`,
          );
          const evalTime = evalResult[0]?.eval_time ? new Date(evalResult[0].eval_time) : new Date();
          const ttlSeconds = env.IDEMPOTENCY_TTL_SECONDS;
          const expiresAt = new Date(evalTime.getTime() + ttlSeconds * 1000);

          await tx.idempotencyRecord.deleteMany({
            where: {
              key: idempotencyKey,
              scope: SCOPE,
              expires_at: { lte: evalTime },
            },
          });

          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              scope: SCOPE,
              payload_hash: payloadHash,
              state: 'PENDING',
              user_id: userId,
              expires_at: expiresAt,
            },
          });

          const initialHolds = await tx.hold.findMany({
            where: { id: { in: sortedHoldIds } },
            select: { id: true, user_id: true, ticket_id: true },
          });

          if (initialHolds.length !== sortedHoldIds.length) {
            throw new NotFoundError('Hold');
          }

          for (const h of initialHolds) {
            if (h.user_id !== userId) {
              throw new NotFoundError('Hold');
            }
          }

          const ticketIdsAsc = Array.from(new Set(initialHolds.map((h) => h.ticket_id))).sort((a, b) => a - b);

          if (ticketIdsAsc.length > 0) {
            await tx.$queryRawUnsafe(
              `SELECT id FROM "Ticket" WHERE id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE`,
              ticketIdsAsc,
            );
          }

          await tx.$queryRawUnsafe(
            `SELECT id FROM "Hold" WHERE id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE`,
            sortedHoldIds,
          );

          const lockedHolds = await tx.hold.findMany({
            where: { id: { in: sortedHoldIds } },
            include: { ticket: true },
            orderBy: { id: 'asc' },
          });

          if (lockedHolds.length !== sortedHoldIds.length) {
            throw new NotFoundError('Hold');
          }

          for (const h of lockedHolds) {
            if (h.user_id !== userId) {
              throw new NotFoundError('Hold');
            }
          }

          const expiredHolds = lockedHolds.filter(
            (h) => h.status === 'EXPIRED' || h.expires_at <= evalTime,
          );

          if (expiredHolds.length > 0) {
            const expiredActiveHoldIds = expiredHolds
              .filter((h) => h.status === 'ACTIVE')
              .map((h) => h.id);

            if (expiredActiveHoldIds.length > 0) {
              await tx.hold.updateMany({
                where: { id: { in: expiredActiveHoldIds } },
                data: { status: 'EXPIRED' },
              });
            }

            const expiredPayload = JSON.stringify({ message: 'One or more holds have expired', code: 'GONE' });
            await tx.idempotencyRecord.update({
              where: {
                key_scope: {
                  key: idempotencyKey,
                  scope: SCOPE,
                },
              },
              data: {
                state: 'COMPLETED',
                status_code: 410,
                response_body: expiredPayload,
                expires_at: expiresAt,
              },
            });

            meterBookingOutcome('EXPIRED');
            meterIdempotencyOutcome('COMPLETED_410');
            return HOLD_EXPIRED_RESULT;
          }

          for (const h of lockedHolds) {
            if (h.status !== 'ACTIVE') {
              throw new ConflictError(`Hold ${h.id} is already ${h.status.toLowerCase()}`);
            }
          }

          const ticketAggregates = new Map<number, { ticket: typeof lockedHolds[0]['ticket']; quantity: number }>();
          for (const h of lockedHolds) {
            const existing = ticketAggregates.get(h.ticket_id);
            if (existing) {
              existing.quantity += h.quantity;
            } else {
              ticketAggregates.set(h.ticket_id, { ticket: h.ticket, quantity: h.quantity });
            }
          }

          let totalAmountDecimal = new Prisma.Decimal(0);
          const detailsData = Array.from(ticketAggregates.values()).map(({ ticket, quantity }) => {
            const subtotal = ticket.price.mul(quantity);
            totalAmountDecimal = totalAmountDecimal.add(subtotal);
            return {
              ticket_id: ticket.id,
              price: ticket.price,
              quantity,
              subtotal,
            };
          });

          const order = await tx.order.create({
            data: {
              user_id: userId,
              status: 'SUCCESS',
              total_amount: totalAmountDecimal,
              details: {
                create: detailsData,
              },
              orderHolds: {
                create: sortedHoldIds.map((holdId) => ({ hold_id: holdId })),
              },
            },
            include: {
              details: {
                include: {
                  ticket: true,
                },
              },
              orderHolds: true,
            },
          });

          const updateResult = await tx.hold.updateMany({
            where: {
              id: { in: sortedHoldIds },
              status: 'ACTIVE',
            },
            data: {
              status: 'CONSUMED',
            },
          });

          if (updateResult.count !== sortedHoldIds.length) {
            throw new ConflictError('Concurrent hold mutation detected during booking');
          }

          const orderDto = formatOrderResponse(order);
          const orderJson = JSON.stringify(orderDto);

          await tx.idempotencyRecord.update({
            where: {
              key_scope: {
                key: idempotencyKey,
                scope: SCOPE,
              },
            },
            data: {
              state: 'COMPLETED',
              status_code: 201,
              response_body: orderJson,
              expires_at: expiresAt,
            },
          });

          return { dto: orderDto, json: orderJson };
        });

        if (orderResult === HOLD_EXPIRED_RESULT) {
          throw new GoneError('One or more holds have expired');
        }

        res.status(201).json(orderResult.dto);
        return;
      } catch (error: any) {
        const isClaimLockTimeout =
          error.code === '55P03' ||
          (error.message && error.message.includes('55P03')) ||
          error instanceof ConflictError && error.message === 'Database lock timeout due to concurrent operations';

        if (isClaimLockTimeout) {
          res.setHeader('Retry-After', '1');
          throw new AppError('Idempotency request in progress', 409, 'IDEMPOTENCY_IN_PROGRESS');
        }

        const isUniqueViolation =
          error.code === 'P2002' ||
          error.code === '23505' ||
          (error.message && (error.message.includes('23505') || error.message.includes('Unique constraint')));

        if (isUniqueViolation) {
          const nowRows = await prisma.$queryRawUnsafe<Array<{ t: Date }>>(
            `SELECT clock_timestamp() AS t`,
          );
          const dbNow = nowRows[0]?.t ? new Date(nowRows[0].t) : new Date();

          const existingRecord = await prisma.idempotencyRecord.findUnique({
            where: {
              key_scope: {
                key: idempotencyKey,
                scope: SCOPE,
              },
            },
          });

          if (!existingRecord) {
            if (attempt < 2) continue;
            throw error;
          }

          if (new Date(existingRecord.expires_at) <= dbNow) {
            await prisma.idempotencyRecord.deleteMany({
              where: {
                key: idempotencyKey,
                scope: SCOPE,
                expires_at: { lte: dbNow },
              },
            });
            if (attempt < 2) continue;
            throw new ConflictError('Idempotency key became expired during retry');
          }

          if (existingRecord.user_id !== userId) {
            throw new ConflictError('Idempotency key belongs to another user');
          }

          if (existingRecord.payload_hash !== payloadHash) {
            throw new ConflictError('Idempotency key reused with different payload');
          }

          if (existingRecord.state === 'PENDING') {
            res.setHeader('Retry-After', '1');
            throw new AppError('Idempotency request in progress', 409, 'IDEMPOTENCY_IN_PROGRESS');
          }

          if (existingRecord.state === 'COMPLETED') {
            if (!existingRecord.response_body) {
              throw new AppError('Corrupt idempotency record response body', 500, 'INTERNAL_ERROR');
            }
            let cached: unknown;
            try {
              cached = JSON.parse(existingRecord.response_body);
            } catch {
              throw new AppError('Corrupt idempotency record JSON payload', 500, 'INTERNAL_ERROR');
            }

            const statusCode = existingRecord.status_code || 201;
            if (statusCode === 410) {
              throw new GoneError(
                typeof cached === 'object' && cached && 'message' in cached
                  ? String((cached as any).message)
                  : 'One or more holds have expired',
              );
            }

            res.status(statusCode).json(cached);
            return;
          }
        }

        throw error;
      }
    }
  });

  router.get('/orders', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      include: {
        details: {
          include: {
            ticket: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(orders);
  });

  return router;
}
