import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    BCRYPT_ROUNDS: '12',
    JWT_ACCESS_SECRET: 'supersecretaccesskeythatisatleast32charslong!',
    JWT_ACCESS_SECRET_FALLBACKS: '',
    JWT_REFRESH_SECRET: 'supersecretrefreshkeythatisatleast32charslong!',
    JWT_REFRESH_SECRET_FALLBACKS: '',
    JWT_ACCESS_EXPIRY: '900',
    JWT_REFRESH_EXPIRY: '604800',
  },
}));

import { hashPassword, comparePassword } from '../../src/lib/hash.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/lib/jwt.js';

describe('Hash Unit Tests', () => {
  it('hashes and compares passwords correctly', async () => {
    const raw = 'Secret123!';
    const hashed = await hashPassword(raw);

    expect(hashed).not.toBe(raw);
    expect(await comparePassword(raw, hashed)).toBe(true);
    expect(await comparePassword('WrongPassword', hashed)).toBe(false);
  });
});

describe('JWT Unit Tests', () => {
  it('signs and verifies access tokens', () => {
    const payload = { sub: 1, username: 'testuser', role: 'USER' };
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');

    const verified = verifyAccessToken(token);
    expect(verified.sub).toBe(1);
    expect(verified.username).toBe('testuser');
    expect(verified.role).toBe('USER');
    expect(verified.type).toBe('access');
  });

  it('signs and verifies refresh tokens', () => {
    const payload = { sub: 1 };
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');

    const verified = verifyRefreshToken(token);
    expect(verified.sub).toBe(1);
    expect(verified.type).toBe('refresh');
  });

  it('rejects invalid or tampered access tokens', () => {
    expect(() => verifyAccessToken('invalid.jwt.token')).toThrow();
  });

  it('rejects invalid or tampered refresh tokens', () => {
    expect(() => verifyRefreshToken('invalid.jwt.token')).toThrow();
  });
});
