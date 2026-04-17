import { prisma } from "../db.js";

export async function computeSellerVisitReminderState(sellerId: string): Promise<{
  needsNewSlot: boolean;
  triggerSlotId: string | null;
  dismissed: boolean;
}> {
  const now = new Date();
  const hasPastSlot = await prisma.inspectionSlot.findFirst({
    where: { sellerId, endAt: { lt: now } },
    select: { id: true },
  });
  const upcomingOpen = await prisma.inspectionSlot.findFirst({
    where: { sellerId, status: "open", endAt: { gt: now } },
    select: { id: true },
  });
  const needsNewSlot = Boolean(hasPastSlot) && !upcomingOpen;
  if (!needsNewSlot) {
    return { needsNewSlot: false, triggerSlotId: null, dismissed: true };
  }
  const trigger = await prisma.inspectionSlot.findFirst({
    where: { sellerId, endAt: { lt: now } },
    orderBy: { endAt: "desc" },
    select: { id: true },
  });
  const triggerSlotId = trigger?.id ?? null;
  if (!triggerSlotId) {
    return { needsNewSlot: false, triggerSlotId: null, dismissed: true };
  }
  const dismissal = await prisma.sellerVisitReminderDismissal.findUnique({
    where: { sellerId_sourceSlotId: { sellerId, sourceSlotId: triggerSlotId } },
  });
  return {
    needsNewSlot: true,
    triggerSlotId,
    dismissed: Boolean(dismissal),
  };
}
