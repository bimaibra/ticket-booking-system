import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import cors from 'cors';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import ticketsRouter from './routes/tickets.js';
import adminRouter from './routes/admin.js';

const openapiDocument = YAML.load('./openapi.yaml');

const app = express();
const PORT = Number.parseInt(env.PORT, 10);

const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: env.NODE_ENV === 'development' ? true : allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/events', ticketsRouter);
app.use('/admin', adminRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use((error: unknown, _req: Request, res: Response, _next: unknown) => {
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

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Dokumentasi API dapat diakses di http://localhost:${PORT}/docs`);
});
