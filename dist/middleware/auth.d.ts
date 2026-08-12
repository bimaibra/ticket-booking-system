import type { NextFunction, Request, Response } from 'express';
import { Role } from '../generated/prisma/enums.js';
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
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
export declare function requireAdmin(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map