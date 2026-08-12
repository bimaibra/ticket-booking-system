import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { Prisma } from '../generated/prisma/client.js';

const router = Router();

const createOrderSchema = z.object({
  hold_id: z.number().int().positive(),
});

const SCOPE = 'POST /orders';

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

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

  const { hold_id } = parsed.data;
  const payloadHash = hashPayload({ hold_id });

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
      return res.status(existingRecord.status_code || 201).json(cached);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const hold = await tx.hold.findUnique({
      where: { id: hold_id },
      include: { ticket: true },
    });

    if (!hold) {
      throw new NotFoundError('Hold');
    }

    if (hold.user_id !== userId) {
      throw new ValidationError('Hold does not belong to user');
    }

    if (hold.status !== 'ACTIVE') {
      throw new ValidationError(`Hold is ${hold.status.toLowerCase()}`);
    }

    if (hold.expires_at < new Date()) {
      await tx.hold.update({
        where: { id: hold_id },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('Hold has expired');
    }

    const subtotal = hold.ticket.price.mul(hold.quantity);

    const order = await tx.order.create({
      data: {
        user_id: userId,
        status: 'SUCCESS',
        total_amount: subtotal,
        expired_at: new Date(Date.now() + 15 * 60 * 1000),
        idempotency_key: idempotencyKey,
        details: {
          create: {
            ticket_id: hold.ticket_id,
            quantity: hold.quantity,
            price: hold.ticket.price,
            subtotal,
          },
        },
      },
      include: {
        details: true,
      },
    });

    await tx.hold.update({
      where: { id: hold_id },
      data: { status: 'CONSUMED', order_id: order.id },
    });

    const responseData = { order, hold_id };

    await tx.idempotencyRecord.upsert({
      where: {
        key_scope: {
          key: idempotencyKey,
          scope: SCOPE,
        },
      },
      update: {
        payload_hash: payloadHash,
        response_body: JSON.stringify(responseData),
        status_code: 201,
        state: 'COMPLETED',
        user_id: userId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      create: {
        key: idempotencyKey,
        scope: SCOPE,
        payload_hash: payloadHash,
        response_body: JSON.stringify(responseData),
        status_code: 201,
        state: 'COMPLETED',
        user_id: userId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return responseData;
  });

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

router.post('/orders/:id/confirm', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const id = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    throw new ValidationError('Invalid order ID');
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    throw new NotFoundError('Order');
  }

  if (order.user_id !== userId) {
    throw new ValidationError('Order does not belong to user');
  }

  if (order.status !== 'PENDING') {
    throw new ValidationError(`Order is already ${order.status.toLowerCase()}`);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'SUCCESS' },
  });

  res.json(updated);
});

export default router;