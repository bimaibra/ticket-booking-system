import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const router = Router();

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

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.total_quota !== undefined) data.total_quota = parsed.data.total_quota;
  if (parsed.data.price !== undefined) data.price = parsed.data.price;

  const updated = await prisma.ticket.update({ where: { id: ticketId }, data });
  res.json(updated);
});

const updateTicketHandler = async (req: Request, res: Response): Promise<void> => {
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

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.total_quota !== undefined) data.total_quota = parsed.data.total_quota;
  if (parsed.data.price !== undefined) data.price = parsed.data.price;

  const updated = await prisma.ticket.update({ where: { id: ticketId }, data });
  res.json(updated);
};

router.patch('/events/:eventId/tickets/:ticketId', authenticate, requireAdmin, updateTicketHandler);

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

  const orderCount = await prisma.orderDetail.count({ where: { ticket_id: ticketId } });
  const holdCount = await prisma.hold.count({ where: { ticket_id: ticketId, status: 'ACTIVE' } });
  if (orderCount > 0 || holdCount > 0) {
    throw new ValidationError('Cannot delete ticket with existing orders or active holds');
  }

  await prisma.ticket.delete({ where: { id: ticketId } });
  res.status(204).end();
});
export default router;