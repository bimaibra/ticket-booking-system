import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client.js';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';
import { createAuthRouter } from './routes/auth.js';
import { createEventsRouter } from './routes/events.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createAdminRouter } from './routes/admin.js';
import { createHoldsRouter } from './routes/holds.js';
import { createOrdersRouter } from './routes/orders.js';
import { logger } from './lib/logger.js';
import { getMetricsSnapshot } from './lib/metrics.js';

export interface AppDependencies {
  prisma: PrismaClient;
}

export interface CreateAppOptions {
  enableScheduler?: boolean;
}

export function createApp(deps: AppDependencies, _options?: CreateAppOptions): Express {
  const openapiDocument = YAML.load('./openapi.yaml');

  const app = express();

  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: env.NODE_ENV === 'development' ? true : allowedOrigins,
      credentials: true,
    }),
  );

  app.use(express.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    (req as any).id = requestId;
    res.setHeader('x-request-id', requestId);
    const childLogger = logger.child({ request_id: requestId });
    (req as any).log = childLogger;
    const start = Date.now();
    res.on('finish', () => {
      childLogger.info(
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration_ms: Date.now() - start,
        },
        'request completed',
      );
    });
    next();
  });

  const parsedMax = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '', 10);
  const maxAuthRequests = Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : env.AUTH_RATE_LIMIT_MAX;

  const authRateLimit = (max: number) =>
    rateLimit({
      windowMs: 60 * 1000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many authentication attempts', code: 'RATE_LIMIT_EXCEEDED' },
    });

  app.use('/auth/login', authRateLimit(maxAuthRequests));
  app.use('/auth/register', authRateLimit(maxAuthRequests));
  app.use('/auth/refresh', authRateLimit(maxAuthRequests));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use('/auth', createAuthRouter(deps.prisma));
  app.use('/events', createEventsRouter(deps.prisma));
  app.use('/events', createTicketsRouter(deps.prisma));
  app.use('/admin', createAdminRouter(deps.prisma));
  app.use('/', createOrdersRouter(deps.prisma));
  app.use('/', createHoldsRouter(deps.prisma));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await deps.prisma.$queryRawUnsafe('SELECT 1');
      res.status(200).json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(getMetricsSnapshot());
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      (req as any).log?.warn({ err: error, code: error.code }, error.message);
      res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
      return;
    }

    if (error instanceof SyntaxError) {
      res.status(400).json({ message: 'Invalid JSON body' });
      return;
    }

    (req as any).log?.error({ err: error }, 'Unhandled error');
    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
}
