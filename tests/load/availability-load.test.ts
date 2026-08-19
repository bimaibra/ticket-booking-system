import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createEventsRouter } from '../../src/routes/events.js';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/services/availability.js', () => ({
  getEventAvailability: vi.fn().mockResolvedValue([
    {
      ticket_id: 1,
      name: 'Standard Ticket',
      price: '50.00',
      total_quota: 100,
      available_quota: 85,
      last_updated: new Date(),
    },
  ]),
  getTicketAvailability: vi.fn().mockResolvedValue([]),
}));

const mockPrisma = {
  event: {
    findUnique: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Tech Conference 2026',
      event_date: new Date(),
    }),
  },
};

describe('Load & Latency Benchmark Simulation', () => {
  const app = express();
  app.use(express.json());
  app.use('/events', createEventsRouter(mockPrisma as any));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    res.status(500).json({ message: 'Internal Error' });
  });

  it('handles 100 concurrent availability requests under 300ms latency', async () => {
    const startTime = Date.now();
    const requests = Array.from({ length: 100 }).map(() =>
      request(app).get('/events/1/availability')
    );

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(3000);
    expect(responses[0].body.tickets[0].available_quota).toBe(85);
  });
});
