import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const router = Router();

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  event_date: z.string().datetime(),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
});

const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  event_date: z.string().datetime().optional(),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
});

router.get('/', async (_req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    orderBy: { event_date: 'asc' },
  });
  res.json(events);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    throw new ValidationError('Invalid event ID');
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    throw new NotFoundError('Event');
  }

  res.json(event);
});

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const event = await prisma.event.create({
    data: {
      name: parsed.data.name,
      event_date: new Date(parsed.data.event_date),
      description: parsed.data.description,
      address: parsed.data.address,
    },
  });

  res.status(201).json(event);
});

router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    throw new ValidationError('Invalid event ID');
  }

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Event');
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.event_date !== undefined) data.event_date = new Date(parsed.data.event_date);
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.address !== undefined) data.address = parsed.data.address;

  const event = await prisma.event.update({ where: { id }, data });
  res.json(event);
});

router.patch('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    throw new ValidationError('Invalid event ID');
  }

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Event');
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.event_date !== undefined) data.event_date = new Date(parsed.data.event_date);
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.address !== undefined) data.address = parsed.data.address;

  const event = await prisma.event.update({ where: { id }, data });
  res.json(event);
});

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    throw new ValidationError('Invalid event ID');
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Event');
  }

  await prisma.event.delete({ where: { id } });
  res.status(204).end();
});
export default router;