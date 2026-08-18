import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export function createAdminRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/orders', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
        details: {
          include: {
            ticket: { select: { id: true, name: true, event_id: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(orders);
  });

  router.get('/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { id: 'asc' },
    });

    res.json(users);
  });

  router.patch('/users/:id/role', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const id = Number.parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      throw new ValidationError('Invalid user ID');
    }

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json(updated);
  });

  return router;
}

