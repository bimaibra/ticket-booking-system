import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { getTicketAvailability } from '../services/availability.js';

const router = Router();

const createHoldSchema = z.object({
  ticket_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

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
  const holdTTLSeconds = Number.parseInt(process.env.HOLD_TTL_SECONDS || '600', 10);

  const result = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticket_id },
      include: {
        event: { select: { id: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    const availability = await getTicketAvailability(ticket.event_id);
    const ticketAvailability = availability.find((a) => a.ticket_id === ticket_id);
    if (!ticketAvailability || ticketAvailability.available_quota < quantity) {
      throw new ConflictError('Insufficient quota for hold');
    }

    const expiresAt = new Date(Date.now() + holdTTLSeconds * 1000);

    const hold = await tx.hold.create({
      data: {
        ticket_id,
        user_id: userId,
        quantity,
        expires_at: expiresAt,
        status: 'ACTIVE',
      },
    });

    return hold;
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

  const hold = await prisma.hold.findUnique({
    where: { id },
  });

  if (!hold) {
    throw new NotFoundError('Hold');
  }

  if (hold.user_id !== userId) {
    throw new ValidationError('Cannot cancel hold owned by another user');
  }

  if (hold.status !== 'ACTIVE') {
    throw new ValidationError(`Hold is already ${hold.status.toLowerCase()}`);
  }

  const updated = await prisma.hold.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  res.json(updated);
});

export default router;