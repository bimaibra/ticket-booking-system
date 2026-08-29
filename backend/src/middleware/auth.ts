import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new AuthenticationError('Authorization header is required');
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AuthenticationError('Invalid authorization header format');
  }

  return token;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.header('authorization'));
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role as Role,
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new AuthenticationError('Access token expired'));
      return;
    }

    if (error instanceof JsonWebTokenError) {
      next(new AuthenticationError('Invalid access token'));
      return;
    }

    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AuthenticationError('Authentication required'));
    return;
  }

  if (req.user.role !== Role.ADMIN) {
    next(new AuthorizationError('Admin access required'));
    return;
  }

  next();
}
