import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError, GoneError } from '../utils/errors.js';
import { withTransactionRetry } from '../utils/transaction.js';

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

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { hold_ids } = parsed.data;
    const sortedHoldIds = [...hold_ids].sort((a, b) => a - b);
    const canonicalPayload = { version: 1, hold_ids: sortedHoldIds };
    const payloadHash = hashPayload(canonicalPayload);

    const existingRecord = await prisma.idempotencyRecord.findUnique({
      where: {
        key_scope: {
          key: idempotencyKey,
          scope: SCOPE,
        },
      },
    });

    if (existingRecord) {
      if (existingRecord.payload_hash !== payloadHash) {
        throw new ConflictError('Idempotency key reused with different payload');
      }
      if (existingRecord.user_id !== userId) {
        throw new ConflictError('Idempotency key belongs to another user');
      }
      if (existingRecord.response_body) {
        const cached = JSON.parse(existingRecord.response_body);
        res.status(existingRecord.status_code || 201).json(cached);
        return;
      }
    }

    const result = await withTransactionRetry(prisma, async (tx) => {
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

      const evalResult = await tx.$queryRawUnsafe<Array<{ eval_time: Date }>>(
        `SELECT clock_timestamp() AS eval_time`,
      );
      const evalTime = evalResult[0]?.eval_time ? new Date(evalResult[0].eval_time) : new Date();

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

      await tx.idempotencyRecord.upsert({
        where: {
          key_scope: {
            key: idempotencyKey,
            scope: SCOPE,
          },
        },
        update: {
          payload_hash: payloadHash,
          response_body: JSON.stringify(order),
          status_code: 201,
          state: 'COMPLETED',
          user_id: userId,
          expires_at: new Date(Date.now() + 86400 * 1000),
        },
        create: {
          key: idempotencyKey,
          scope: SCOPE,
          payload_hash: payloadHash,
          response_body: JSON.stringify(order),
          status_code: 201,
          state: 'COMPLETED',
          user_id: userId,
          expires_at: new Date(Date.now() + 86400 * 1000),
        },
      });

      return order;
    });

    if (result === HOLD_EXPIRED_RESULT) {
      throw new GoneError('One or more holds have expired');
    }

    res.status(201).json(result);
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
