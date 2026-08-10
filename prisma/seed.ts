import 'dotenv/config';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const rounds = Number.parseInt(env.BCRYPT_ROUNDS, 10) || DEFAULT_BCRYPT_ROUNDS;
  const hashedAdminPassword = await bcrypt.hash('admin123', rounds);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password_hash: hashedAdminPassword,
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      name: 'System Administrator',
      email: 'admin@example.com',
      password_hash: hashedAdminPassword,
      role: 'ADMIN',
    },
  });

  const hashedUserPassword = await bcrypt.hash('user123', rounds);
  const user = await prisma.user.upsert({
    where: { username: 'user' },
    update: {
      password_hash: hashedUserPassword,
      role: 'USER',
    },
    create: {
      username: 'user',
      name: 'Sample User',
      email: 'user@example.com',
      password_hash: hashedUserPassword,
      role: 'USER',
    },
  });

  const event = await prisma.event.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Konser Musik K-Pop 2026',
      event_date: new Date('2026-10-15T19:00:00Z'),
      description: 'Konser megah tahunan',
      address: 'Jakarta International Stadium',
    },
  });

  const vipPrice = new Prisma.Decimal('1500000.0000');
  await prisma.ticket.upsert({
    where: { id: 1 },
    update: {},
    create: {
      event_id: event.id,
      name: 'VIP',
      total_quota: 100,
      price: vipPrice,
    },
  });

  const regularPrice = new Prisma.Decimal('500000.0000');
  await prisma.ticket.upsert({
    where: { id: 2 },
    update: {},
    create: {
      event_id: event.id,
      name: 'Regular',
      total_quota: 500,
      price: regularPrice,
    },
  });

  console.log('Seed completed:');
  console.log(`  admin  -> ${admin.username} (id=${admin.id})`);
  console.log(`  user   -> ${user.username} (id=${user.id})`);
  console.log(`  event  -> ${event.name} (id=${event.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
