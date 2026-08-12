import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
const MIN_BCRYPT_ROUNDS = 12;
const configuredRounds = Number.parseInt(env.BCRYPT_ROUNDS, 10);
if (Number.isNaN(configuredRounds) || configuredRounds < MIN_BCRYPT_ROUNDS) {
    throw new Error(`BCRYPT_ROUNDS must be at least ${MIN_BCRYPT_ROUNDS}`);
}
export const BCRYPT_ROUNDS = configuredRounds;
export function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}
export function comparePassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}
//# sourceMappingURL=hash.js.map