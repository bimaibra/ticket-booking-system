import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { verifyMigrationState } from './src/utils/migrationCheck.js';
import { anonymizeUser } from './src/services/userAnonymization.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

let failures = 0;

async function report(name: string, pass: boolean, detail = ''): Promise<void> {
  if (!pass) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
}

const state = await verifyMigrationState(prisma);
await report('migration state: OrderDetail ticket idx', state.hasOrderDetailTicketIdx);
await report('migration state: OrderHold table', state.hasOrderHoldTable);
await report('migration state: OrderHold unique hold idx', state.hasOrderHoldUniqueHoldIdx);
await report('migration state: OrderHold order idx', state.hasOrderHoldOrderIdx);
await report('migration state: all CHECK constraints', state.hasCheckConstraints);
await report('migration state: IdempotencyState enum', state.hasIdempotencyStateEnum);
await report('migration state: state column is enum', state.hasIdempotencyStateColumnEnum);
await report('migration state: Order.idempotency_key removed', state.hasNoOrderIdempotencyKeyColumn);
await report('migration state: Hold.order_id removed', state.hasNoHoldOrderIdColumn);

const user = await prisma.user.create({
  data: { username: 'v_user', name: 'V User', email: 'v@example.com', password_hash: 'h' },
});
const event = await prisma.event.create({
  data: { name: 'v-event', event_date: new Date('2026-12-31') },
});
const ticket = await prisma.ticket.create({
  data: { event_id: event.id, name: 'V', total_quota: 10, price: '20.00' },
});

async function expectRejected(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    await report(name, false, 'write unexpectedly succeeded');
  } catch (err) {
    await report(name, true, String((err as Error).message).split(/\r?\n/)[0].slice(0, 90));
  }
}

await expectRejected('CHECK: negative total_quota rejected', () =>
  prisma.$executeRawUnsafe(
    `INSERT INTO "Ticket" (event_id, name, total_quota, price, created_at, updated_at) VALUES (${event.id}, 'bad', -5, 10.00, NOW(), NOW())`
  )
);

await expectRejected('CHECK: negative price rejected', () =>
  prisma.$executeRawUnsafe(
    `INSERT INTO "Ticket" (event_id, name, total_quota, price, created_at, updated_at) VALUES (${event.id}, 'bad', 10, -1.00, NOW(), NOW())`
  )
);

await expectRejected('CHECK: hold quantity 0 rejected', () =>
  prisma.$executeRawUnsafe(
    `INSERT INTO "Hold" (user_id, ticket_id, quantity, expires_at, status, created_at, updated_at) VALUES (${user.id}, ${ticket.id}, 0, NOW(), 'ACTIVE', NOW(), NOW())`
  )
);

await expectRejected('CHECK: invalid status_code rejected', () =>
  prisma.$executeRawUnsafe(
    `INSERT INTO "IdempotencyRecord" (key, scope, payload_hash, state, status_code, expires_at, created_at, updated_at) VALUES ('k1','s1','h1','PENDING'::"IdempotencyState", 42, NOW(), NOW(), NOW())`
  )
);

await expectRejected('CHECK: nonnegative order total rejected', () =>
  prisma.$executeRawUnsafe(
    `INSERT INTO "Order" (user_id, total_amount, status, created_at, updated_at) VALUES (${user.id}, -100, 'SUCCESS', NOW(), NOW())`
  )
);

const ohUniqueA = await prisma.order.create({
  data: { user_id: user.id, total_amount: '20.00', status: 'SUCCESS', orderHolds: { create: [] } },
});

const hold = await prisma.hold.create({
  data: { user_id: user.id, ticket_id: ticket.id, quantity: 1, expires_at: new Date(Date.now() + 60000) },
});
const order = await prisma.order.create({
  data: {
    user_id: user.id,
    total_amount: '20.00',
    status: 'SUCCESS',
    orderHolds: { create: [{ hold_id: hold.id }] },
  },
  include: { orderHolds: true },
});
await report('OrderHold link created', order.orderHolds.length === 1);

await expectRejected('OrderHold unique hold_id enforced', () =>
  prisma.orderHold.create({ data: { order_id: order.id, hold_id: hold.id } })
);

await expectRejected('OrderHold hold_id cannot be reused by another order', () =>
  prisma.order.create({
    data: {
      user_id: user.id,
      total_amount: '20.00',
      status: 'SUCCESS',
      orderHolds: { create: [{ hold_id: hold.id }] },
    },
  })
);

await anonymizeUser(prisma, user.id);
const anon = await prisma.user.findUnique({ where: { id: user.id } });
await report('anonymization: credentials removed', !anon?.password_hash.startsWith('h') && anon?.refresh_token === null);
await report('anonymization: id preserved', anon?.id === user.id && anon.username.startsWith('deleted_'));

const holdCount = await prisma.hold.count({ where: { user_id: user.id } });
await report('anonymization: booking history retained', holdCount === 1);

await prisma.$disconnect();
// eslint-disable-next-line no-console
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);