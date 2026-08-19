import express from 'express';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import cors from 'cors';
import type { PrismaClient } from './generated/prisma/client.js';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';
import { createAuthRouter } from './routes/auth.js';
import { createEventsRouter } from './routes/events.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createAdminRouter } from './routes/admin.js';
import { createHoldsRouter } from './routes/holds.js';
import { createOrdersRouter } from './routes/orders.js';

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

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use('/auth', createAuthRouter(deps.prisma));
  app.use('/events', createEventsRouter(deps.prisma));
  app.use(createTicketsRouter(deps.prisma));
  app.use('/admin', createAdminRouter(deps.prisma));
  app.use('/', createOrdersRouter(deps.prisma));
  app.use('/', createHoldsRouter(deps.prisma));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) {
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

    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
}