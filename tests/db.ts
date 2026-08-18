import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export interface TestDatabase {
  container: any;
  prisma: PrismaClient;
  connectionString: string;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionString = container.getConnectionUri();

  process.env.DATABASE_URL = connectionString;

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: connectionString },
  });

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  return { container, prisma, connectionString };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.prisma.$disconnect();
  await db.container.stop();
}

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.idempotencyRecord.deleteMany();
  await prisma.orderDetail.deleteMany();
  await prisma.order.deleteMany();
  await prisma.hold.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}


