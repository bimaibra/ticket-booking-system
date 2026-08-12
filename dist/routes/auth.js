import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { env } from '../config/env.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { AuthenticationError, ConflictError, ValidationError } from '../utils/errors.js';
const router = Router();
const registerSchema = z.object({
    username: z.string().min(3).max(50),
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
});
const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
const refreshSchema = z.object({
    refresh_token: z.string().min(1),
});
router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { username, name, email, password } = parsed.data;
    const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
    });
    if (existing) {
        if (existing.username === username) {
            throw new ConflictError('Username already exists');
        }
        throw new ConflictError('Email already exists');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            username,
            name,
            email,
            password_hash: passwordHash,
        },
        select: {
            id: true,
            username: true,
            name: true,
            email: true,
            role: true,
            created_at: true,
            updated_at: true,
        },
    });
    res.status(201).json(user);
});
router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { username, password } = parsed.data;
    const user = await prisma.user.findUnique({
        where: { username },
    });
    if (!user) {
        throw new AuthenticationError('Invalid username or password');
    }
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
        throw new AuthenticationError('Invalid username or password');
    }
    const accessToken = signAccessToken({
        sub: user.id,
        username: user.username,
        role: user.role,
    });
    const refreshToken = signRefreshToken({ sub: user.id });
    const refreshHash = await bcrypt.hash(refreshToken, Number.parseInt(env.BCRYPT_ROUNDS, 10));
    await prisma.user.update({
        where: { id: user.id },
        data: { refresh_token: refreshHash },
    });
    res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at,
        },
    });
});
router.post('/refresh', async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { refresh_token } = parsed.data;
    let payload;
    try {
        payload = verifyRefreshToken(refresh_token);
    }
    catch {
        throw new AuthenticationError('Invalid refresh token');
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
    });
    if (!user || !user.refresh_token) {
        throw new AuthenticationError('Invalid refresh token');
    }
    const valid = await bcrypt.compare(refresh_token, user.refresh_token);
    if (!valid) {
        throw new AuthenticationError('Invalid refresh token');
    }
    const newAccessToken = signAccessToken({
        sub: user.id,
        username: user.username,
        role: user.role,
    });
    const newRefreshToken = signRefreshToken({ sub: user.id });
    const newRefreshHash = await bcrypt.hash(newRefreshToken, Number.parseInt(env.BCRYPT_ROUNDS, 10));
    await prisma.user.update({
        where: { id: user.id },
        data: { refresh_token: newRefreshHash },
    });
    res.json({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
    });
});
router.post('/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new AuthenticationError();
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = verifyAccessToken(token);
        userId = payload.sub;
    }
    catch {
        throw new AuthenticationError();
    }
    await prisma.user.update({
        where: { id: userId },
        data: { refresh_token: null },
    });
    res.status(204).end();
});
export default router;
//# sourceMappingURL=auth.js.map