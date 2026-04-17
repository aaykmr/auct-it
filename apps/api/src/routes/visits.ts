import { randomBytes, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { optionalUser, requireUser, requireVerifiedSeller } from "../lib/auth.js";
import { createCashfreePgOrder, createCashfreePgRefund } from "../lib/cashfree.js";
import { defaultPublicWebUrl, sendSlotCancelledNotice } from "../lib/outbound.js";
import { computeSellerVisitReminderState } from "../lib/visit-reminder.js";

const optionalMapsUrl = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

function phone10Digits(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "9999999999";
}

export async function registerVisitRoutes(app: FastifyInstance) {
  app.get("/v1/listings/:listingId/inspection-slots", { preHandler: optionalUser }, async (req, reply) => {
    const params = z.object({ listingId: z.string() }).parse(req.params);
    const listing = await prisma.listing.findUnique({ where: { id: params.listingId } });
    if (!listing) return reply.status(404).send({ error: "Listing not found" });
    const userId =
      req.user && typeof req.user === "object" && "sub" in req.user
        ? (req.user as { sub: string }).sub
        : undefined;
    const isSeller = Boolean(userId && listing.sellerId === userId);
    const slots = await prisma.inspectionSlot.findMany({
      where: {
        OR: [{ listingId: listing.id }, { listingId: null, sellerId: listing.sellerId }],
        ...(isSeller ? {} : { status: "open" }),
      },
      orderBy: { startAt: "asc" },
      include: { city: true },
    });
    const slotIds = slots.map((s) => s.id);
    const paidSlotIds = new Set<string>();
    const joinedSlotIds = new Set<string>();
    if (userId && !isSeller && slotIds.length > 0) {
      const [paidRows, attendeeRows] = await Promise.all([
        prisma.visitFeeOrder.findMany({
          where: { buyerId: userId, status: "paid", slotId: { in: slotIds } },
          select: { slotId: true },
        }),
        prisma.inspectionSlotAttendee.findMany({
          where: { buyerId: userId, slotId: { in: slotIds } },
          select: { slotId: true },
        }),
      ]);
      for (const r of paidRows) paidSlotIds.add(r.slotId);
      for (const a of attendeeRows) joinedSlotIds.add(a.slotId);
    }
    return reply.send({
      slots: slots.map((s) => {
        const buyerPaid = Boolean(userId && !isSeller && paidSlotIds.has(s.id));
        return {
          id: s.id,
          city: s.city,
          cityId: s.cityId,
          startAt: s.startAt,
          endAt: s.endAt,
          /** Seller sees summary; buyers only after visit fee (exact location stays hidden otherwise). */
          ...(isSeller || buyerPaid ? { addressSummary: s.addressSummary } : {}),
          ...(isSeller ? { addressFull: s.addressFull } : {}),
          maxBuyerCapacity: s.maxBuyerCapacity,
          status: s.status,
          ...(userId && !isSeller
            ? {
                visitFeePaid: paidSlotIds.has(s.id),
                joined: joinedSlotIds.has(s.id),
                ...(buyerPaid
                  ? {
                      fullAddress: s.addressFull,
                      mapsUrl: s.mapsUrl,
                    }
                  : {}),
              }
            : {}),
          ...(isSeller ? { mapsUrl: s.mapsUrl } : {}),
        };
      }),
    });
  });

  app.post("/v1/listings/:listingId/inspection-slots", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ listingId: z.string() }).parse(req.params);
    const body = z
      .object({
        cityId: z.string(),
        addressSummary: z.string().min(3),
        addressFull: z.string().min(5),
        startAt: z.coerce.date(),
        endAt: z.coerce.date(),
        maxBuyerCapacity: z.coerce.number().int().min(1).max(500).optional(),
        mapsUrl: optionalMapsUrl,
      })
      .parse(req.body);
    const listing = await prisma.listing.findFirst({
      where: { id: params.listingId, sellerId },
    });
    if (!listing) return reply.status(404).send({ error: "Listing not found" });
    const slot = await prisma.inspectionSlot.create({
      data: {
        listingId: listing.id,
        sellerId,
        cityId: body.cityId,
        addressSummary: body.addressSummary,
        addressFull: body.addressFull,
        startAt: body.startAt,
        endAt: body.endAt,
        maxBuyerCapacity: body.maxBuyerCapacity ?? 20,
        status: "open",
        ...(body.mapsUrl !== undefined ? { mapsUrl: body.mapsUrl } : {}),
      },
      include: { city: true },
    });
    return reply.send({ slot });
  });

  app.patch("/v1/inspection-slots/:id", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        mapsUrl: z.union([z.string().url(), z.literal(""), z.null()]),
      })
      .parse(req.body);
    const mapsUrl = body.mapsUrl === "" || body.mapsUrl === null ? null : body.mapsUrl;
    const slot = await prisma.inspectionSlot.findFirst({
      where: { id: params.id, sellerId },
    });
    if (!slot) return reply.status(404).send({ error: "Slot not found" });
    const updated = await prisma.inspectionSlot.update({
      where: { id: slot.id },
      data: { mapsUrl },
      include: { city: true },
    });
    return reply.send({ slot: updated });
  });

  app.get("/v1/me/seller/inspection-slots", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const slots = await prisma.inspectionSlot.findMany({
      where: { sellerId },
      orderBy: { startAt: "desc" },
      include: { city: true },
    });
    return reply.send({
      slots: slots.map((s) => ({
        id: s.id,
        listingId: s.listingId,
        city: s.city,
        startAt: s.startAt,
        endAt: s.endAt,
        addressSummary: s.addressSummary,
        addressFull: s.addressFull,
        mapsUrl: s.mapsUrl,
        maxBuyerCapacity: s.maxBuyerCapacity,
        status: s.status,
      })),
    });
  });

  app.post("/v1/me/seller/inspection-slots", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const body = z
      .object({
        cityId: z.string(),
        addressSummary: z.string().min(3),
        addressFull: z.string().min(5),
        startAt: z.coerce.date(),
        endAt: z.coerce.date(),
        maxBuyerCapacity: z.coerce.number().int().min(1).max(500).optional(),
        mapsUrl: optionalMapsUrl,
      })
      .parse(req.body);
    const slot = await prisma.inspectionSlot.create({
      data: {
        listingId: null,
        sellerId,
        cityId: body.cityId,
        addressSummary: body.addressSummary,
        addressFull: body.addressFull,
        startAt: body.startAt,
        endAt: body.endAt,
        maxBuyerCapacity: body.maxBuyerCapacity ?? 20,
        status: "open",
        ...(body.mapsUrl !== undefined ? { mapsUrl: body.mapsUrl } : {}),
      },
      include: { city: true },
    });
    return reply.send({ slot });
  });

  app.get("/v1/me/seller/visit-reminder", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const state = await computeSellerVisitReminderState(sellerId);
    return reply.send({
      needsNewSlot: state.needsNewSlot,
      triggerSlotId: state.triggerSlotId,
      dismissed: state.dismissed,
    });
  });

  app.post("/v1/me/seller/visit-reminder/dismiss", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const body = z.object({ sourceSlotId: z.string() }).parse(req.body);
    const state = await computeSellerVisitReminderState(sellerId);
    if (!state.triggerSlotId || state.triggerSlotId !== body.sourceSlotId) {
      return reply.status(400).send({ error: "Nothing to dismiss for this slot" });
    }
    await prisma.sellerVisitReminderDismissal.upsert({
      where: { sellerId_sourceSlotId: { sellerId, sourceSlotId: body.sourceSlotId } },
      create: { sellerId, sourceSlotId: body.sourceSlotId },
      update: {},
    });
    return reply.send({ ok: true });
  });

  app.post("/v1/inspection-slots/:id/cancel", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
    const slot = await prisma.inspectionSlot.findFirst({
      where: { id: params.id, sellerId },
    });
    if (!slot) return reply.status(404).send({ error: "Slot not found" });
    await prisma.inspectionSlot.update({
      where: { id: slot.id },
      data: { status: "cancelled" },
    });
    const attendees = await prisma.inspectionSlotAttendee.findMany({
      where: { slotId: slot.id },
      select: { buyerId: true },
    });
    const paidFees = await prisma.visitFeeOrder.findMany({
      where: { slotId: slot.id, status: "paid" },
      select: { buyerId: true },
    });
    const buyerIds = new Set<string>();
    for (const a of attendees) buyerIds.add(a.buyerId);
    for (const p of paidFees) buyerIds.add(p.buyerId);
    for (const buyerId of buyerIds) {
      await prisma.visitSlotBuyerCancellation.upsert({
        where: { slotId_buyerId: { slotId: slot.id, buyerId } },
        create: { slotId: slot.id, buyerId, resolution: "pending" },
        update: {},
      });
    }
    const cancellations = await prisma.visitSlotBuyerCancellation.findMany({
      where: { slotId: slot.id, resolution: "pending" },
      include: { buyer: true },
    });
    const base = defaultPublicWebUrl();
    for (const c of cancellations) {
      await sendSlotCancelledNotice({
        buyerId: c.buyerId,
        toPhone: c.buyer.mobileNumber,
        message: `AuctIt: Your inspection visit was cancelled. Choose a refund or a new time: ${base}/me/visits/resolve/${c.id}`,
        channels: ["sms", "whatsapp"],
      });
    }
    return reply.send({ ok: true, affectedBuyers: buyerIds.size });
  });

  app.get("/v1/me/visit-cancellations/:id", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const row = await prisma.visitSlotBuyerCancellation.findFirst({
      where: { id: params.id, buyerId },
      include: {
        slot: { include: { city: true } },
        targetSlot: { include: { city: true } },
      },
    });
    if (!row) return reply.status(404).send({ error: "Not found" });
    const openSlots = await prisma.inspectionSlot.findMany({
      where: {
        sellerId: row.slot.sellerId,
        status: "open",
        endAt: { gt: new Date() },
        id: { not: row.slotId },
      },
      orderBy: { startAt: "asc" },
      include: { city: true },
      take: 30,
    });
    return reply.send({
      cancellation: {
        id: row.id,
        resolution: row.resolution,
        slot: row.slot,
        targetSlotId: row.targetSlotId,
      },
      alternativeSlots: openSlots.map((s) => ({
        id: s.id,
        city: s.city,
        startAt: s.startAt,
        endAt: s.endAt,
        addressSummary: s.addressSummary,
      })),
    });
  });

  app.post("/v1/me/visit-cancellations/:id/choose-refund", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const row = await prisma.visitSlotBuyerCancellation.findFirst({
      where: { id: params.id, buyerId, resolution: "pending" },
      include: { slot: true },
    });
    if (!row) return reply.status(404).send({ error: "Nothing to resolve" });
    const vfo = await prisma.visitFeeOrder.findFirst({
      where: { buyerId, slotId: row.slotId, status: "paid" },
      include: { paymentOrder: true },
    });
    if (!vfo) {
      await prisma.visitSlotBuyerCancellation.update({
        where: { id: row.id },
        data: { resolution: "refunded" },
      });
      return reply.send({ ok: true, refunded: false, message: "No visit fee to refund" });
    }
    if (vfo.paymentOrder.status === "refunded") {
      await prisma.visitSlotBuyerCancellation.update({
        where: { id: row.id },
        data: { resolution: "refunded" },
      });
      return reply.send({ ok: true, refunded: true });
    }
    try {
      const idem = `refund-visit-${vfo.paymentOrderId}`;
      await createCashfreePgRefund(vfo.paymentOrderId, Number(vfo.amountInr), idem);
      await prisma.$transaction([
        prisma.paymentOrder.update({
          where: { id: vfo.paymentOrderId },
          data: { status: "refunded" },
        }),
        prisma.visitFeeOrder.update({
          where: { id: vfo.id },
          data: { status: "refunded" },
        }),
        prisma.visitSlotBuyerCancellation.update({
          where: { id: row.id },
          data: { resolution: "refunded" },
        }),
      ]);
      return reply.send({ ok: true, refunded: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refund failed";
      return reply.status(502).send({ error: msg });
    }
  });

  app.post("/v1/me/visit-cancellations/:id/choose-slot", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ newSlotId: z.string() }).parse(req.body);
    const row = await prisma.visitSlotBuyerCancellation.findFirst({
      where: { id: params.id, buyerId, resolution: "pending" },
      include: { slot: true },
    });
    if (!row) return reply.status(404).send({ error: "Nothing to resolve" });
    const newSlot = await prisma.inspectionSlot.findFirst({
      where: {
        id: body.newSlotId,
        sellerId: row.slot.sellerId,
        status: "open",
        endAt: { gt: new Date() },
      },
    });
    if (!newSlot) return reply.status(400).send({ error: "Invalid or unavailable slot" });
    const winnerFulfillment = newSlot.listingId
      ? await prisma.orderFulfillment.findFirst({
          where: {
            buyerId,
            auction: { listingId: newSlot.listingId, status: "ended" },
          },
        })
      : await prisma.orderFulfillment.findFirst({
          where: {
            buyerId,
            sellerId: newSlot.sellerId,
            auction: { status: "ended" },
          },
        });
    if (!winnerFulfillment) {
      return reply.status(403).send({ error: "You cannot join this slot with your current wins" });
    }
    const count = await prisma.inspectionSlotAttendee.count({ where: { slotId: newSlot.id } });
    if (count >= newSlot.maxBuyerCapacity) {
      return reply.status(400).send({ error: "Slot is full" });
    }
    await prisma.$transaction(async (tx) => {
      await tx.inspectionSlotAttendee.deleteMany({
        where: { slotId: row.slotId, buyerId },
      });
      await tx.inspectionSlotAttendee.create({
        data: { slotId: newSlot.id, buyerId, status: "joined" },
      });
      await tx.visitFeeOrder.updateMany({
        where: { buyerId, slotId: row.slotId },
        data: { slotId: newSlot.id },
      });
      await tx.visitAccessToken.updateMany({
        where: { buyerId, slotId: row.slotId },
        data: { slotId: newSlot.id },
      });
      const orders = await tx.paymentOrder.findMany({
        where: { userId: buyerId, kind: "visit_fee" },
      });
      for (const o of orders) {
        const meta = (o.metadata ?? {}) as { slotId?: string };
        if (meta.slotId === row.slotId) {
          await tx.paymentOrder.update({
            where: { id: o.id },
            data: { metadata: { ...meta, slotId: newSlot.id } },
          });
        }
      }
      await tx.visitSlotBuyerCancellation.update({
        where: { id: row.id },
        data: { resolution: "completed_move", targetSlotId: newSlot.id },
      });
    });
    return reply.send({ ok: true, newSlotId: newSlot.id });
  });

  app.post("/v1/inspection-slots/:id/join", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const slot = await prisma.inspectionSlot.findUnique({ where: { id: params.id } });
    if (!slot || slot.status !== "open") return reply.status(400).send({ error: "Slot not available" });
    const winnerFulfillment = slot.listingId
      ? await prisma.orderFulfillment.findFirst({
          where: {
            buyerId,
            auction: { listingId: slot.listingId, status: "ended" },
          },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.orderFulfillment.findFirst({
          where: {
            buyerId,
            sellerId: slot.sellerId,
            auction: { status: "ended" },
          },
          orderBy: { createdAt: "desc" },
        });
    if (!winnerFulfillment) {
      return reply.status(403).send({ error: "Only the buyer who won the auction for this item can schedule a visit" });
    }
    try {
      await prisma.inspectionSlotAttendee.create({
        data: { slotId: slot.id, buyerId, status: "joined" },
      });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
      if (code !== "P2002") throw e;
    }
    return reply.send({ ok: true });
  });

  app.post("/v1/inspection-slots/:id/visit-fee", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const slot = await prisma.inspectionSlot.findUnique({ where: { id: params.id } });
    if (!slot) return reply.status(404).send({ error: "Not found" });
    const idempotencyKey = `visit-${slot.id}-${buyerId}`;
    const existing = await prisma.paymentOrder.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "paid") {
      return reply.send({ order: existing, alreadyPaid: true });
    }
    const order =
      existing ??
      (await prisma.paymentOrder.create({
        data: {
          userId: buyerId,
          kind: "visit_fee",
          amount: env.VISIT_FEE_INR,
          idempotencyKey,
          status: "created",
          metadata: { slotId: slot.id },
        },
      }));
    const user = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!user) return reply.status(404).send({ error: "Not found" });
    const returnUrl = `${env.PUBLIC_WEB_URL}/payments/return?order_id={order_id}`;
    const notifyUrl = `${env.PUBLIC_API_URL.replace(/\/$/, "")}/v1/webhooks/cashfree`;
    let updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "pending",
        metadata: { slotId: slot.id, returnUrl, notifyUrl },
      },
    });
    try {
      const cf = await createCashfreePgOrder({
        orderId: order.id,
        orderAmount: Number(env.VISIT_FEE_INR),
        customerId: user.id,
        customerPhone: phone10Digits(user.mobileNumber),
        customerName: user.name?.trim().length ? user.name.trim() : "Buyer",
        returnUrl,
        notifyUrl,
        orderNote: "Visit fee",
      });
      updated = await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          cfOrderId: cf.cfOrderId || order.id,
          metadata: {
            slotId: slot.id,
            paymentSessionId: cf.paymentSessionId,
            cashfreeOrderId: cf.cfOrderId,
          },
        },
      });
      return reply.send({
        paymentOrder: updated,
        cashfree: {
          paymentSessionId: cf.paymentSessionId,
          orderAmount: Number(env.VISIT_FEE_INR),
          orderCurrency: "INR",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cashfree error";
      return reply.status(502).send({
        error: msg,
        paymentOrder: updated,
        cashfree: null as null,
      });
    }
  });

  app.post("/v1/payments/visit-fee/:orderId/confirm", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ orderId: z.string() }).parse(req.params);
    const order = await prisma.paymentOrder.findFirst({
      where: { id: params.orderId, userId: buyerId, kind: "visit_fee" },
    });
    if (!order) return reply.status(404).send({ error: "Not found" });
    const slotId = (order.metadata as { slotId?: string })?.slotId;
    if (!slotId) return reply.status(400).send({ error: "Invalid order" });
    await prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: "paid" },
      });
      await tx.visitFeeOrder.upsert({
        where: { paymentOrderId: order.id },
        update: { status: "paid", paidAt: new Date() },
        create: {
          buyerId,
          slotId,
          amountInr: env.VISIT_FEE_INR,
          paymentOrderId: order.id,
          status: "paid",
          paidAt: new Date(),
        },
      });
      const token = randomBytes(24).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await tx.visitAccessToken.create({
        data: {
          slotId,
          buyerId,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revealedAt: new Date(),
        },
      });
    });
    return reply.send({ ok: true, accessToken: "use GET slot detail with auth" });
  });

  app.get("/v1/inspection-slots/:id/detail", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const slot = await prisma.inspectionSlot.findUnique({
      where: { id: params.id },
      include: { city: true, listing: true },
    });
    if (!slot) return reply.status(404).send({ error: "Not found" });
    const paid = await prisma.visitFeeOrder.findFirst({
      where: { buyerId, slotId: slot.id, status: "paid" },
    });
    return reply.send({
      slot: {
        id: slot.id,
        city: slot.city,
        addressSummary: paid ? slot.addressSummary : null,
        startAt: slot.startAt,
        endAt: slot.endAt,
        listingTitle: slot.listing?.title ?? slot.addressSummary,
        fullAddress: paid ? slot.addressFull : null,
        mapsUrl: paid ? slot.mapsUrl : null,
        unlocked: !!paid,
      },
    });
  });
}
