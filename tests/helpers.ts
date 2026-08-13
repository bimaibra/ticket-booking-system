import express from 'express';
import cors from 'cors';
import { env } from '../src/config/env.js';
import { AppError } from '../src/utils/errors.js';
import authRouter from '../src/routes/auth.js';
import eventsRouter from '../src/routes/events.js';
import ticketsRouter from '../src/routes/tickets.js';
import adminRouter from '../src/routes/admin.js';
import holdsRouter from '../src/routes/holds.js';
import ordersRouter from '../src/routes/orders.js';

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/auth', authRouter);
  app.use('/events', eventsRouter);
  app.use('/events', ticketsRouter);
  app.use('/admin', adminRouter);
  app.use('/', ordersRouter);
  app.use('/', holdsRouter);

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

    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
}
