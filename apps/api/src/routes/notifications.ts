import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireUser } from "../lib/auth.js";
import { computeSellerVisitReminderState } from "../lib/visit-reminder.js";

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get("/v1/me/notifications/summary", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const [sellerReminder, pendingCancellations] = await Promise.all([
      computeSellerVisitReminderState(userId),
      prisma.visitSlotBuyerCancellation.count({
        where: { buyerId: userId, resolution: "pending" },
      }),
    ]);
    const sellerUnread =
      sellerReminder.needsNewSlot && !sellerReminder.dismissed && sellerReminder.triggerSlotId ? 1 : 0;
    const unreadCount = sellerUnread + pendingCancellations;
    return reply.send({ unreadCount, sellerVisitReminderUnread: sellerUnread, visitCancellationUnread: pendingCancellations });
  });

  app.get("/v1/me/notifications", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const items: Array<{
      kind: string;
      id: string;
      title: string;
      href: string;
      createdAt: string;
    }> = [];

    const reminder = await computeSellerVisitReminderState(userId);
    if (reminder.needsNewSlot && !reminder.dismissed && reminder.triggerSlotId) {
      items.push({
        kind: "seller_visit_reminder",
        id: `reminder:${reminder.triggerSlotId}`,
        title: "Add a new visit slot — your last window has ended.",
        href: "/seller/visits",
        createdAt: new Date().toISOString(),
      });
    }

    const cancellations = await prisma.visitSlotBuyerCancellation.findMany({
      where: { buyerId: userId, resolution: "pending" },
      include: {
        slot: { include: { city: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    for (const c of cancellations) {
      items.push({
        kind: "visit_slot_cancelled",
        id: c.id,
        title: `Visit cancelled: ${c.slot.city.name} · ${new Date(c.slot.startAt).toLocaleString()}`,
        href: `/me/visits/resolve/${c.id}`,
        createdAt: c.createdAt.toISOString(),
      });
    }

    return reply.send({ items });
  });
}
