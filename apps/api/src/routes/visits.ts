import { randomBytes, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser, requireVerifiedSeller } from "../lib/auth.js";

export async function registerVisitRoutes(app: FastifyInstance) {
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
      },
      include: { city: true },
    });
    return reply.send({ slot });
  });

  app.post("/v1/inspection-slots/:id/join", { preHandler: requireUser }, async (req, reply) => {
    const buyerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const slot = await prisma.inspectionSlot.findUnique({ where: { id: params.id } });
    if (!slot || slot.status !== "open") return reply.status(400).send({ error: "Slot not available" });
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
    const cfOrderId = `cf_visit_${order.id}`;
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        cfOrderId,
        status: "pending",
        metadata: { slotId: slot.id, redirect: `${env.PUBLIC_WEB_URL}/payments/return` },
      },
    });
    return reply.send({
      paymentOrder: updated,
      cashfree: {
        orderId: cfOrderId,
        orderAmount: env.VISIT_FEE_INR,
        orderCurrency: "INR",
        message: "Stub: integrate Cashfree hosted checkout with returned session",
      },
    });
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
        addressSummary: slot.addressSummary,
        startAt: slot.startAt,
        endAt: slot.endAt,
        listingTitle: slot.listing.title,
        fullAddress: paid ? slot.addressFull : null,
        unlocked: !!paid,
      },
    });
  });
}
