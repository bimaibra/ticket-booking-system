import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { resetMetrics, incrementCounter, observeHistogram, getMetricsSnapshot } from '../../src/lib/metrics.js';
import { createGracefulShutdown } from '../../src/lib/shutdown.js';
import { authenticate, requireAdmin } from '../../src/middleware/auth.js';
import { AuthenticationError, AuthorizationError } from '../../src/utils/errors.js';
import { signAccessToken } from '../../src/lib/jwt.js';

describe('Metrics Unit Tests', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('increments tagged counters and renders a Prometheus snapshot', () => {
    incrementCounter('hold_outcomes_total', { outcome: 'CREATED' });
    incrementCounter('hold_outcomes_total', { outcome: 'CREATED' });
    incrementCounter('hold_outcomes_total', { outcome: 'CANCELLED' });

    const snapshot = getMetricsSnapshot();
    expect(snapshot).toContain('# TYPE hold_outcomes_total counter');
    expect(snapshot).toContain('hold_outcomes_total');
    expect(snapshot).toContain('2');
  });

  it('renders histograms with p95 and count', () => {
    for (let i = 1; i <= 100; i++) {
      observeHistogram('booking_duration_ms', i);
    }

    const snapshot = getMetricsSnapshot();
    expect(snapshot).toContain('# TYPE booking_duration_ms histogram');
    expect(snapshot).toContain('booking_duration_ms_p95_ms');
    expect(snapshot).toContain('booking_duration_ms_count 100');
  });

  it('skips empty histograms', () => {
    const snapshot = getMetricsSnapshot();
    expect(snapshot).not.toContain('histogram');
  });
});

describe('Graceful Shutdown Unit Tests', () => {
  it('closes the server, runs scheduler stop and disconnect', async () => {
    const server = {
      close: (cb: () => void) => cb(),
    } as any;
    const stopScheduler = vi.fn();
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const shutdown = createGracefulShutdown({ server, stopScheduler, disconnect });
    await shutdown('SIGTERM');

    expect(stopScheduler).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('resolves when no server is present', async () => {
    const shutdown = createGracefulShutdown({ server: null });
    await expect(shutdown('SIGINT')).resolves.toBeUndefined();
  });
});

describe('Auth Middleware Unit Tests', () => {
  function mockRes(): Response {
    return {} as Response;
  }

  function mockReq(headers: Record<string, string> = {}): Request {
    return {
      headers,
      header: (name: string) => headers[name.toLowerCase()] || headers[name],
    } as unknown as Request;
  }

  it('passes a valid access token through to req.user', () => {
    const token = signAccessToken({ sub: 7, username: 'alice', role: 'USER' });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: 7, username: 'alice', role: 'USER' });
  });

  it('rejects a missing authorization header', () => {
    const req = mockReq({});
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('rejects a malformed authorization header', () => {
    const req = mockReq({ authorization: 'Token abc' });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('rejects a tampered token', () => {
    const req = mockReq({ authorization: 'Bearer not.a.jwt' });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('Invalid access token');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { sub: 1, username: 'old', role: 'USER' },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: -10 },
    );
    const req = mockReq({ authorization: `Bearer ${expired}` });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('Access token expired');
  });

  it('requireAdmin rejects when no user is attached', () => {
    const req = {} as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('requireAdmin rejects non-admin users', () => {
    const req = { user: { id: 1, username: 'user', role: 'USER' } } as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, mockRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('requireAdmin passes for admin users', () => {
    const req = { user: { id: 1, username: 'admin', role: 'ADMIN' } } as Request;
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});
