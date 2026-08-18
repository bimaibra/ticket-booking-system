import type { PrismaClient } from '../generated/prisma/client.js';

export interface MigrationVerificationResult {
  hasOrderDetailTicketIdx: boolean;
  hasOrderHoldTable: boolean;
  hasOrderHoldUniqueHoldIdx: boolean;
  hasOrderHoldOrderIdx: boolean;
  hasCheckConstraints: boolean;
  hasIdempotencyStateEnum: boolean;
  hasIdempotencyStateColumnEnum: boolean;
  hasNoOrderIdempotencyKeyColumn: boolean;
  hasNoHoldOrderIdColumn: boolean;
}

const EXPECTED_CHECK_CONSTRAINTS = [
  'Ticket_total_quota_positive',
  'Hold_quantity_positive',
  'OrderDetail_quantity_positive',
  'OrderDetail_price_nonneg',
  'OrderDetail_subtotal_nonneg',
  'Order_total_amount_nonneg',
  'Ticket_price_nonneg',
  'IdempotencyRecord_status_code_valid',
];

export async function verifyMigrationState(prisma: PrismaClient): Promise<MigrationVerificationResult> {
  const orderDetailIndex = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'OrderDetail' AND indexname = 'OrderDetail_ticket_id_idx'
  `;

  const orderHoldTable = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE tablename = 'OrderHold'
  `;

  const orderHoldUnique = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'OrderHold' AND indexname = 'OrderHold_hold_id_key'
  `;

  const orderHoldOrderIdx = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'OrderHold' AND indexname = 'OrderHold_order_id_idx'
  `;

  const checks = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname FROM pg_constraint
    WHERE conname = ANY(${EXPECTED_CHECK_CONSTRAINTS}::text[])
  `;

  const stateEnum = await prisma.$queryRaw<Array<{ typname: string }>>`
    SELECT typname FROM pg_type WHERE typname = 'IdempotencyState'
  `;

  const stateColumn = await prisma.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'IdempotencyRecord' AND column_name = 'state'
  `;

  const orderColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'idempotency_key'
  `;

  const holdColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Hold' AND column_name = 'order_id'
  `;

  return {
    hasOrderDetailTicketIdx: orderDetailIndex.length > 0,
    hasOrderHoldTable: orderHoldTable.length > 0,
    hasOrderHoldUniqueHoldIdx: orderHoldUnique.length > 0,
    hasOrderHoldOrderIdx: orderHoldOrderIdx.length > 0,
    hasCheckConstraints: checks.length === EXPECTED_CHECK_CONSTRAINTS.length,
    hasIdempotencyStateEnum: stateEnum.length > 0,
    hasIdempotencyStateColumnEnum: stateColumn.length > 0 && stateColumn[0]?.data_type === 'USER-DEFINED',
    hasNoOrderIdempotencyKeyColumn: orderColumns.length === 0,
    hasNoHoldOrderIdColumn: holdColumns.length === 0,
  };
}