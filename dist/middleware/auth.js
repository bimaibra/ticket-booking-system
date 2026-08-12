import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
function extractBearerToken(authorizationHeader) {
    if (!authorizationHeader) {
        throw new AuthenticationError('Authorization header is required');
    }
    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        throw new AuthenticationError('Invalid authorization header format');
    }
    return token;
}
export function authenticate(req, _res, next) {
    try {
        const token = extractBearerToken(req.header('authorization'));
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
        };
        next();
    }
    catch (error) {
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
export function requireAdmin(req, _res, next) {
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
//# sourceMappingURL=auth.js.map