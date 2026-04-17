import { createHash, randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../lib/auth.js";

export async function registerFulfillmentRoutes(app: FastifyInstance) {
  app.get("/v1/fulfillments/mine", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const rows = await prisma.orderFulfillment.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        auction: { include: { listing: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ fulfillments: rows });
  });

  app.post("/v1/fulfillments/:auctionId/otp", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ auctionId: z.string() }).parse(req.params);
    const fulfillment = await prisma.orderFulfillment.findUnique({
      where: { auctionId: params.auctionId },
    });
    if (!fulfillment || fulfillment.sellerId !== userId) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const otp = String(randomInt(100000, 999999));
    const handoverOtpHash = createHash("sha256").update(otp).digest("hex");
    await prisma.orderFulfillment.update({
      where: { id: fulfillment.id },
      data: { handoverOtpHash, status: "in_transit" },
    });
    return reply.send({ otp, message: "Share this OTP with buyer at pickup (dev: returned in response)" });
  });

  app.post("/v1/fulfillments/:auctionId/complete", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ auctionId: z.string() }).parse(req.params);
    const body = z
      .object({
        mode: z.enum(["pickup", "delivery"]),
        otp: z.string().optional(),
        proofRef: z.string().optional(),
        proofType: z.enum(["photo", "signature", "video"]).optional(),
      })
      .parse(req.body);
    const fulfillment = await prisma.orderFulfillment.findUnique({
      where: { auctionId: params.auctionId },
      include: { auction: true },
    });
    if (!fulfillment) return reply.status(404).send({ error: "Not found" });
    if (body.mode === "pickup" && fulfillment.buyerId === userId) {
      if (!fulfillment.handoverOtpHash || !body.otp) {
        return reply.status(400).send({ error: "OTP required" });
      }
      const hash = createHash("sha256").update(body.otp).digest("hex");
      if (hash !== fulfillment.handoverOtpHash) {
        return reply.status(400).send({ error: "Invalid OTP" });
      }
    } else if (body.mode === "pickup" && fulfillment.sellerId === userId) {
      return reply.status(400).send({ error: "Buyer must confirm OTP" });
    }
    const completedAt = new Date();
    const disputeWindowEndsAt = new Date(completedAt.getTime() + env.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.orderFulfillment.update({
        where: { id: fulfillment.id },
        data: {
          mode: body.mode,
          status: "completed",
          completedAt,
          disputeWindowEndsAt,
        },
      });
      if (body.proofRef && body.proofType) {
        await tx.fulfillmentProof.create({
          data: {
            fulfillmentId: fulfillment.id,
            proofType: body.proofType,
            proofRef: body.proofRef,
            verifiedAt: new Date(),
            verifiedBy: userId,
          },
        });
      }
    });
    return reply.send({ ok: true, disputeWindowEndsAt });
  });

  app.post("/v1/fulfillments/:auctionId/release-payout", { preHandler: requireUser }, async (req, reply) => {
    const params = z.object({ auctionId: z.string() }).parse(req.params);
    const fulfillment = await prisma.orderFulfillment.findUnique({
      where: { auctionId: params.auctionId },
    });
    if (!fulfillment || fulfillment.status !== "completed") {
      return reply.status(400).send({ error: "Fulfillment not complete" });
    }
    const openDispute = await prisma.orderDispute.findFirst({
      where: {
        fulfillmentId: fulfillment.id,
        status: { in: ["open", "under_review"] },
      },
    });
    if (openDispute) {
      return reply.status(400).send({ error: "Dispute open" });
    }
    if (fulfillment.disputeWindowEndsAt && new Date() < fulfillment.disputeWindowEndsAt) {
      const recentDispute = await prisma.orderDispute.findFirst({
        where: { fulfillmentId: fulfillment.id, openedAt: { gte: fulfillment.completedAt ?? new Date(0) } },
      });
      if (recentDispute) {
        return reply.status(400).send({ error: "Resolve disputes first" });
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.sellerPayout.updateMany({
        where: { auctionId: params.auctionId },
        data: { status: "released", releasedAt: new Date(), releaseTrigger: "auto_after_window" },
      });
    });
    return reply.send({ ok: true });
  });
}
