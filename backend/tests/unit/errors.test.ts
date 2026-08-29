import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError } from '../../src/utils/errors.js';

describe('Errors', () => {
  it('AppError creates correct structure', () => {
    const err = new AppError('Custom message', 418, 'TEAPOT');
    expect(err.message).toBe('Custom message');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.isOperational).toBe(true);
  });

  it('ValidationError creates 400 status code', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid input');
  });

  it('AuthenticationError creates 401 status code', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });

  it('AuthorizationError creates 403 status code', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Forbidden');
  });

  it('NotFoundError creates 404 status code', () => {
    const err = new NotFoundError('Event');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Event not found');
  });

  it('ConflictError creates 409 status code', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Already exists');
  });
});
