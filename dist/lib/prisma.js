import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
const databaseUrl = env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: databaseUrl });
export const prisma = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
});
export async function disconnectPrisma() {
    await prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map