import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  HistoryRetainedError,
} from '../utils/errors.js';
import { withTransactionRetry } from '../utils/transaction.js';

const createTicketSchema = z.object({
  name: z.string().min(1).max(200),
  total_quota: z.number().int().positive(),
  price: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

const updateTicketSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  total_quota: z.number().int().positive().optional(),
  price: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
});

async function checkTicketHistory(tx: any, ticketId: number): Promise<void> {
  const holdCount = await tx.hold.count({ where: { ticket_id: ticketId } });
  if (holdCount > 0) {
    throw new HistoryRetainedError('Cannot delete ticket with existing hold history');
  }

  const orderDetailCount = await tx.orderDetail.count({ where: { ticket_id: ticketId } });
  if (orderDetailCount > 0) {
    throw new HistoryRetainedError('Cannot delete ticket with existing order history');
  }

  const orderHoldCount = await tx.orderHold.count({
    where: { hold: { ticket_id: ticketId } },
  });
  if (orderHoldCount > 0) {
    throw new HistoryRetainedError('Cannot delete ticket with existing order hold history');
  }
}

function buildTicketUpdate(
  parsed: { name?: string; total_quota?: number; price?: string },
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.total_quota !== undefined) data.total_quota = parsed.total_quota;
  if (parsed.price !== undefined) data.price = parsed.price;
  return data;
}

export function createTicketsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/events/:eventId/tickets', async (req: Request, res: Response) => {
    const eventId = Number.parseInt(req.params.eventId as string, 10);
    if (Number.isNaN(eventId)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError('Event');
    }

    const tickets = await prisma.ticket.findMany({
      where: { event_id: eventId },
      orderBy: { id: 'asc' },
    });

    res.json(tickets);
  });

  router.post('/events/:eventId/tickets', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const eventId = Number.parseInt(req.params.eventId as string, 10);
    if (Number.isNaN(eventId)) {
      throw new ValidationError('Invalid event ID');
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError('Event');
    }

    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const ticket = await prisma.ticket.create({
      data: {
        event_id: eventId,
        name: parsed.data.name,
        total_quota: parsed.data.total_quota,
        price: parsed.data.price,
      },
    });

    res.status(201).json(ticket);
  });

  router.put('/events/:eventId/tickets/:ticketId', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const eventId = Number.parseInt(req.params.eventId as string, 10);
    const ticketId = Number.parseInt(req.params.ticketId as string, 10);
    if (Number.isNaN(eventId) || Number.isNaN(ticketId)) {
      throw new ValidationError('Invalid event or ticket ID');
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, event_id: eventId },
    });
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const updated = await withTransactionRetry(prisma, async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: number; total_quota: number }>>(
        `SELECT id, total_quota FROM "Ticket" WHERE id = $1 FOR UPDATE`,
        ticketId,
      );

      if (locked.length === 0) {
        throw new NotFoundError('Ticket');
      }

      if (parsed.data.total_quota !== undefined) {
        const allocated = await tx.$queryRawUnsafe<
          Array<{ allocated: number | null }>
        >(
          `SELECT
             COALESCE((
               SELECT SUM(h.quantity)
               FROM "Hold" h
               WHERE h.ticket_id = $1
                 AND h.status = 'ACTIVE'
                 AND h.expires_at > clock_timestamp()
             ), 0)
             + COALESCE((
               SELECT SUM(od.quantity)
               FROM "OrderDetail" od
               JOIN "Order" o ON o.id = od.order_id
               WHERE od.ticket_id = $1
                 AND o.status = 'SUCCESS'
             ), 0) AS allocated`,
          ticketId,
        );
        const allocatedQuantity = Number(allocated[0]?.allocated ?? 0);

        if (parsed.data.total_quota < allocatedQuantity) {
          throw new ConflictError(
            `Cannot reduce total_quota below allocated quantity ${allocatedQuantity}`,
          );
        }
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: buildTicketUpdate(parsed.data),
      });
    });

    res.json(updated);
  });

  router.patch('/events/:eventId/tickets/:ticketId', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const eventId = Number.parseInt(req.params.eventId as string, 10);
    const ticketId = Number.parseInt(req.params.ticketId as string, 10);
    if (Number.isNaN(eventId) || Number.isNaN(ticketId)) {
      throw new ValidationError('Invalid event or ticket ID');
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, event_id: eventId },
    });
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const updated = await withTransactionRetry(prisma, async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: number; total_quota: number }>>(
        `SELECT id, total_quota FROM "Ticket" WHERE id = $1 FOR UPDATE`,
        ticketId,
      );

      if (locked.length === 0) {
        throw new NotFoundError('Ticket');
      }

      if (parsed.data.total_quota !== undefined) {
        const allocated = await tx.$queryRawUnsafe<
          Array<{ allocated: number | null }>
        >(
          `SELECT
             COALESCE((
               SELECT SUM(h.quantity)
               FROM "Hold" h
               WHERE h.ticket_id = $1
                 AND h.status = 'ACTIVE'
                 AND h.expires_at > clock_timestamp()
             ), 0)
             + COALESCE((
               SELECT SUM(od.quantity)
               FROM "OrderDetail" od
               JOIN "Order" o ON o.id = od.order_id
               WHERE od.ticket_id = $1
                 AND o.status = 'SUCCESS'
             ), 0) AS allocated`,
          ticketId,
        );
        const allocatedQuantity = Number(allocated[0]?.allocated ?? 0);

        if (parsed.data.total_quota < allocatedQuantity) {
          throw new ConflictError(
            `Cannot reduce total_quota below allocated quantity ${allocatedQuantity}`,
          );
        }
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: buildTicketUpdate(parsed.data),
      });
    });

    res.json(updated);
  });

  router.delete('/events/:eventId/tickets/:ticketId', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const eventId = Number.parseInt(req.params.eventId as string, 10);
    const ticketId = Number.parseInt(req.params.ticketId as string, 10);
    if (Number.isNaN(eventId) || Number.isNaN(ticketId)) {
      throw new ValidationError('Invalid event or ticket ID');
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, event_id: eventId },
    });
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    await withTransactionRetry(prisma, async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "Ticket" WHERE id = $1 FOR UPDATE`,
        ticketId,
      );

      if (locked.length === 0) {
        throw new NotFoundError('Ticket');
      }

      await checkTicketHistory(tx, ticketId);

      try {
        await tx.ticket.delete({ where: { id: ticketId } });
      } catch (error: any) {
        if (error && (error.code === 'P2003' || error.code === '23503')) {
          throw new HistoryRetainedError('Cannot delete ticket with existing history');
        }
        throw error;
      }
    });

    res.status(204).end();
  });

  return router;
}
