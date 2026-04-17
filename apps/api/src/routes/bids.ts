import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { broadcastAuctionState, processBidInline } from "../bid-worker.js";
import { publishBidMessage } from "../rabbit.js";
import { requireUser } from "../lib/auth.js";

export async function registerBidRoutes(app: FastifyInstance) {
  app.get("/v1/auctions/:id/bids/mine", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const auction = await prisma.auction.findUnique({ where: { id: params.id } });
    if (!auction) return reply.status(404).send({ error: "Auction not found" });
    const top = await prisma.bid.findFirst({
      where: { auctionId: params.id, status: "accepted" },
      orderBy: { amount: "desc" },
    });
    const userLatest = await prisma.bid.findFirst({
      where: { auctionId: params.id, bidderId: userId, status: "accepted" },
      orderBy: { createdAt: "desc" },
    });
    const canCancel = !!(top && userLatest && top.id === userLatest.id && auction.endAt > new Date());
    return reply.send({
      myLatestBidAmount: userLatest?.amount.toString() ?? null,
      canCancel,
    });
  });

  app.delete("/v1/auctions/:id/bids/mine", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { listing: true },
    });
    if (!auction) return reply.status(404).send({ error: "Auction not found" });
    const now = new Date();
    if (auction.endAt < now || auction.status === "ended" || auction.status === "cancelled") {
      return reply.status(400).send({ error: "Auction is not accepting changes" });
    }

    const top = await prisma.bid.findFirst({
      where: { auctionId: params.id, status: "accepted" },
      orderBy: { amount: "desc" },
    });
    const userLatest = await prisma.bid.findFirst({
      where: { auctionId: params.id, bidderId: userId, status: "accepted" },
      orderBy: { createdAt: "desc" },
    });
    if (!top || !userLatest || top.id !== userLatest.id) {
      return reply
        .status(400)
        .send({ error: "Only your current winning bid can be withdrawn, and it must be your latest bid" });
    }

    await prisma.bid.update({ where: { id: top.id }, data: { status: "rejected" } });
    await broadcastAuctionState(params.id);
    return reply.send({ ok: true });
  });

  app.post("/v1/auctions/:id/bids", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ amount: z.coerce.number().positive() }).parse(req.body);
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { listing: true },
    });
    if (!auction) return reply.status(404).send({ error: "Auction not found" });
    if (auction.listing.sellerId === userId) {
      return reply.status(403).send({ error: "You cannot bid on your own listing" });
    }
    if (auction.endAt < new Date()) {
      return reply.status(400).send({ error: "Auction ended" });
    }
    const bid = await prisma.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: userId,
        amount: body.amount,
        status: "pending",
      },
    });
    const queued = await publishBidMessage({
      auctionId: auction.id,
      bidderId: userId,
      amount: bid.amount.toString(),
      bidId: bid.id,
    });
    if (!queued) {
      await processBidInline({
        auctionId: auction.id,
        bidderId: userId,
        amount: bid.amount.toString(),
        bidId: bid.id,
      });
    }
    return reply.send({ bidId: bid.id, status: "pending", queued });
  });
}
