-- AlterTable: Order remove expired_at
ALTER TABLE "Order" DROP COLUMN IF EXISTS "expired_at";
