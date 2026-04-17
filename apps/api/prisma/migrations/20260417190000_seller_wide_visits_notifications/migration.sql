-- AlterTable
ALTER TABLE "InspectionSlot" ALTER COLUMN "listingId" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "VisitCancellationResolution" AS ENUM ('pending', 'refund_requested', 'reschedule_chosen', 'refunded', 'completed_move');

-- CreateTable
CREATE TABLE "SellerVisitReminderDismissal" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sourceSlotId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerVisitReminderDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSlotBuyerCancellation" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "resolution" "VisitCancellationResolution" NOT NULL DEFAULT 'pending',
    "targetSlotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitSlotBuyerCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessageLog" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerVisitReminderDismissal_sellerId_sourceSlotId_key" ON "SellerVisitReminderDismissal"("sellerId", "sourceSlotId");

-- CreateIndex
CREATE INDEX "SellerVisitReminderDismissal_sellerId_idx" ON "SellerVisitReminderDismissal"("sellerId");

-- CreateIndex
CREATE INDEX "VisitSlotBuyerCancellation_buyerId_resolution_idx" ON "VisitSlotBuyerCancellation"("buyerId", "resolution");

-- CreateIndex
CREATE UNIQUE INDEX "VisitSlotBuyerCancellation_slotId_buyerId_key" ON "VisitSlotBuyerCancellation"("slotId", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMessageLog_idempotencyKey_key" ON "OutboundMessageLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InspectionSlot_sellerId_status_endAt_idx" ON "InspectionSlot"("sellerId", "status", "endAt");

-- AddForeignKey
ALTER TABLE "SellerVisitReminderDismissal" ADD CONSTRAINT "SellerVisitReminderDismissal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSlotBuyerCancellation" ADD CONSTRAINT "VisitSlotBuyerCancellation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "InspectionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSlotBuyerCancellation" ADD CONSTRAINT "VisitSlotBuyerCancellation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSlotBuyerCancellation" ADD CONSTRAINT "VisitSlotBuyerCancellation_targetSlotId_fkey" FOREIGN KEY ("targetSlotId") REFERENCES "InspectionSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
