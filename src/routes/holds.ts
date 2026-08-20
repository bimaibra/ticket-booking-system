import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError, GoneError } from '../utils/errors.js';
import { getSingleTicketAvailability } from '../services/availability.js';
import { env } from '../config/env.js';
import { meterHoldOutcome } from '../lib/metrics.js';
import { withTransactionRetry } from '../utils/transaction.js';

const createHoldSchema = z.object({
  ticket_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

const HOLD_TTL_SECONDS = env.HOLD_TTL_SECONDS;

const HOLD_EXPIRED_RESULT = Symbol('HOLD_EXPIRED');

export function createHoldsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/holds', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const parsed = createHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { ticket_id, quantity } = parsed.data;

    const result = await withTransactionRetry(prisma, async (tx) => {
      const ticket = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "Ticket" WHERE id = $1 FOR UPDATE`,
        ticket_id,
      );

      if (ticket.length === 0) {
        throw new NotFoundError('Ticket');
      }

      const ticketAvailability = await getSingleTicketAvailability(tx, ticket_id);

      if (ticketAvailability.available_quota < quantity) {
        meterHoldOutcome('INSUFFICIENT_QUOTA');
        throw new ConflictError(
          `Insufficient quota for hold: requested ${quantity}, available ${ticketAvailability.available_quota}`,
        );
      }

      const evaluationTime = new Date(ticketAvailability.last_updated);

      return tx.hold.create({
        data: {
          ticket_id,
          user_id: userId,
          quantity,
          expires_at: new Date(evaluationTime.getTime() + HOLD_TTL_SECONDS * 1000),
          status: 'ACTIVE',
        },
      });
    });

    res.status(201).json(result);
  });

  router.delete('/holds/:id', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const id = Number.parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      throw new ValidationError('Invalid hold ID');
    }

    const result = await withTransactionRetry(prisma, async (tx) => {
      const hold = await tx.hold.findUnique({
        where: { id },
      });

      if (!hold) {
        throw new NotFoundError('Hold');
      }

      const ticket = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "Ticket" WHERE id = $1 FOR UPDATE`,
        hold.ticket_id,
      );

      const lockedHold = await tx.hold.findUnique({
        where: { id },
      });

      if (!lockedHold || lockedHold.user_id !== userId) {
        throw new ValidationError('Cannot cancel hold owned by another user');
      }

      const evalResult = await tx.$queryRawUnsafe<Array<{ eval_time: Date }>>(
        `SELECT clock_timestamp() AS eval_time`,
      );
      const evalTime = evalResult[0]?.eval_time ? new Date(evalResult[0].eval_time) : new Date();

      if (lockedHold.status === 'EXPIRED' || lockedHold.expires_at <= evalTime) {
        if (lockedHold.status === 'ACTIVE') {
          await tx.hold.update({
            where: { id },
            data: { status: 'EXPIRED' },
          });
        }
        return HOLD_EXPIRED_RESULT;
      }

      if (lockedHold.status !== 'ACTIVE') {
        throw new ValidationError(`Hold is already ${lockedHold.status.toLowerCase()}`);
      }

      return tx.hold.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    if (result === HOLD_EXPIRED_RESULT) {
      throw new GoneError('Hold has expired');
    }

    res.json(result);
  });

  return router;
}
