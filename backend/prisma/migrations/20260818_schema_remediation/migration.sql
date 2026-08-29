-- CreateEnum: IdempotencyState
CREATE TYPE "IdempotencyState" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable: IdempotencyRecord.state from String to Enum
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "state" TYPE "IdempotencyState" USING "state"::"IdempotencyState";
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "state" SET DEFAULT 'PENDING';

-- CreateIndex: OrderDetail(ticket_id)
CREATE INDEX "OrderDetail_ticket_id_idx" ON "OrderDetail"("ticket_id");

-- CreateTable: OrderHold
CREATE TABLE "OrderHold" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "hold_id" INTEGER NOT NULL,
    CONSTRAINT "OrderHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderHold_hold_id_key" ON "OrderHold"("hold_id");
CREATE INDEX "OrderHold_order_id_idx" ON "OrderHold"("order_id");

-- Migrate existing Hold.order_id links to OrderHold
INSERT INTO "OrderHold" ("order_id", "hold_id")
SELECT "order_id", "id" FROM "Hold" WHERE "order_id" IS NOT NULL;

-- DropForeignKey: Hold.order_id
ALTER TABLE "Hold" DROP CONSTRAINT IF EXISTS "Hold_order_id_fkey";

-- DropColumn: Hold.order_id
ALTER TABLE "Hold" DROP COLUMN IF EXISTS "order_id";

-- DropForeignKey: Order.user_id (re-add with Restrict)
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_user_id_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: Hold.user_id (re-add with Restrict)
ALTER TABLE "Hold" DROP CONSTRAINT IF EXISTS "Hold_user_id_fkey";
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: Hold.ticket_id (re-add with Restrict)
ALTER TABLE "Hold" DROP CONSTRAINT IF EXISTS "Hold_ticket_id_fkey";
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: OrderDetail.ticket_id (re-add with Restrict)
ALTER TABLE "OrderDetail" DROP CONSTRAINT IF EXISTS "OrderDetail_ticket_id_fkey";
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: OrderHold
ALTER TABLE "OrderHold" ADD CONSTRAINT "OrderHold_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderHold" ADD CONSTRAINT "OrderHold_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "Hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropColumn: Order.idempotency_key
DROP INDEX IF EXISTS "Order_idempotency_key_key";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "idempotency_key";

-- CHECK constraints
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_total_quota_positive" CHECK ("total_quota" > 0);
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_subtotal_nonneg" CHECK ("subtotal" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_amount_nonneg" CHECK ("total_amount" >= 0);
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_status_code_valid" CHECK ("status_code" IS NULL OR ("status_code" >= 100 AND "status_code" <= 599));
