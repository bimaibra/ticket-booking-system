import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: number;
  username: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: number;
  type: 'refresh';
}

const ACCESS_ALGORITHM = 'HS256' as const;
const REFRESH_ALGORITHM = 'HS256' as const;
const ISSUER = 'ticket-booking-system';
const AUDIENCE = 'ticket-booking-api';
const PRIMARY_KID = 'primary';

function parseFallbackSecrets(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const accessFallbackSecrets = parseFallbackSecrets(env.JWT_ACCESS_SECRET_FALLBACKS);
const refreshFallbackSecrets = parseFallbackSecrets(env.JWT_REFRESH_SECRET_FALLBACKS);

function resolveSigningSecret(
  token: string,
  primarySecret: string,
  fallbackSecrets: string[],
): string {
  const header = jwt.decode(token, { complete: true });
  const kid = typeof header === 'object' && header !== null ? (header.header.kid as string | undefined) : undefined;

  if (kid === PRIMARY_KID || kid === undefined) {
    return primarySecret;
  }

  const index = Number.parseInt(kid, 10);
  if (!Number.isNaN(index) && index > 0 && index <= fallbackSecrets.length) {
    const fallbackSecret = fallbackSecrets[index - 1];
    if (fallbackSecret) {
      return fallbackSecret;
    }
  }

  throw new jwt.JsonWebTokenError('Unknown signing key id');
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: ACCESS_ALGORITHM,
      expiresIn: Number.parseInt(env.JWT_ACCESS_EXPIRY, 10),
      issuer: ISSUER,
      audience: AUDIENCE,
      keyid: PRIMARY_KID,
    },
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      algorithm: REFRESH_ALGORITHM,
      expiresIn: Number.parseInt(env.JWT_REFRESH_EXPIRY, 10),
      issuer: ISSUER,
      audience: AUDIENCE,
      keyid: PRIMARY_KID,
    },
  );
}

function isAccessTokenPayload(value: string | JwtPayload): value is JwtPayload & AccessTokenPayload {
  return (
    typeof value !== 'string' &&
    typeof value.sub === 'number' &&
    typeof value.username === 'string' &&
    typeof value.role === 'string' &&
    value.type === 'access'
  );
}

function isRefreshTokenPayload(value: string | JwtPayload): value is JwtPayload & RefreshTokenPayload {
  return typeof value !== 'string' && typeof value.sub === 'number' && value.type === 'refresh';
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(
    token,
    resolveSigningSecret(token, env.JWT_ACCESS_SECRET, accessFallbackSecrets),
    {
      algorithms: [ACCESS_ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );

  if (!isAccessTokenPayload(decoded)) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return {
    sub: decoded.sub,
    username: decoded.username,
    role: decoded.role,
    type: decoded.type,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(
    token,
    resolveSigningSecret(token, env.JWT_REFRESH_SECRET, refreshFallbackSecrets),
    {
      algorithms: [REFRESH_ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );

  if (!isRefreshTokenPayload(decoded)) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return {
    sub: decoded.sub,
    type: decoded.type,
  };
}
