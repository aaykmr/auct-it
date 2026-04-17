import type { ConsumeMessage } from "amqplib";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "./db.js";
import { BIDS_QUEUE, getRabbitChannel } from "./rabbit.js";
import { getRedis } from "./redis.js";
import { publicBidderLabel } from "./lib/public-bidder.js";

export type BidMessage = {
  auctionId: string;
  bidderId: string;
  amount: string;
  bidId: string;
};

export async function startBidWorker(): Promise<void> {
  const ch = await getRabbitChannel();
  if (!ch) {
    console.warn("[bid-worker] RabbitMQ not available; bid processing disabled");
    return;
  }
  await ch.prefetch(1);
  await ch.consume(
    BIDS_QUEUE,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      let data: BidMessage;
      try {
        data = JSON.parse(msg.content.toString()) as BidMessage;
      } catch {
        ch.nack(msg, false, false);
        return;
      }
      try {
        await processBid(data);
        ch.ack(msg);
      } catch (e) {
        console.error("[bid-worker]", e);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );
  console.log("[bid-worker] consuming", BIDS_QUEUE);
}

async function broadcastAuction(auctionId: string, payload: object) {
  const redis = getRedis();
  const message = JSON.stringify({ type: "bid_update", auctionId, ...payload });
  if (redis) {
    await redis.publish(`auction:${auctionId}`, message);
  }
}

/** Re-publish current highest bid after cancel or external change */
export async function broadcastAuctionState(auctionId: string) {
  const latest = await prisma.bid.findFirst({
    where: { auctionId, status: "accepted" },
    orderBy: { amount: "desc" },
    include: { bidder: { select: { name: true } } },
  });
  await broadcastAuction(auctionId, {
    highest: latest
      ? { amount: latest.amount.toString(), bidderName: publicBidderLabel(latest.bidder.name) }
      : null,
    bidId: latest?.id ?? null,
  });
}

/** Inline fallback when RabbitMQ is unavailable */
export async function processBidInline(data: BidMessage) {
  return processBid(data);
}

async function processBid(data: BidMessage) {
  const amount = new Decimal(data.amount);
  const result = await prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: data.auctionId },
      include: {
        listing: true,
        bids: { where: { status: "accepted" }, orderBy: { amount: "desc" }, take: 1 },
      },
    });
    if (!auction) {
      await tx.bid.update({ where: { id: data.bidId }, data: { status: "rejected" } });
      return null;
    }
    const now = new Date();
    if (now > auction.endAt || auction.status === "ended" || auction.status === "cancelled") {
      if (auction.status !== "ended") {
        await tx.auction.update({ where: { id: auction.id }, data: { status: "ended" } });
      }
      await tx.bid.update({ where: { id: data.bidId }, data: { status: "rejected" } });
      return null;
    }
    if (auction.status === "scheduled" && now >= auction.startAt && now <= auction.endAt) {
      await tx.auction.update({ where: { id: auction.id }, data: { status: "live" } });
    }
    const effectiveAuction = await tx.auction.findUnique({
      where: { id: data.auctionId },
      include: {
        listing: true,
        bids: { where: { status: "accepted" }, orderBy: { amount: "desc" }, take: 1 },
      },
    });
    if (!effectiveAuction) return null;
    if (effectiveAuction.status === "scheduled" && now < effectiveAuction.startAt) {
      await tx.bid.update({ where: { id: data.bidId }, data: { status: "rejected" } });
      return null;
    }
    if (effectiveAuction.listing.sellerId === data.bidderId) {
      await tx.bid.update({ where: { id: data.bidId }, data: { status: "rejected" } });
      return null;
    }
    const top = effectiveAuction.bids[0];
    const minBid = top ? top.amount.plus(new Decimal("0.01")) : effectiveAuction.listing.basePrice;
    if (amount.lt(minBid)) {
      await tx.bid.update({ where: { id: data.bidId }, data: { status: "rejected" } });
      return null;
    }
    await tx.bid.update({
      where: { id: data.bidId },
      data: { status: "accepted" },
    });
    await tx.bidEvent.create({
      data: {
        auctionId: effectiveAuction.id,
        payload: { bidId: data.bidId, amount: data.amount, bidderId: data.bidderId },
      },
    });
    return effectiveAuction.id;
  });

  if (!result) return;

  const latest = await prisma.bid.findFirst({
    where: { auctionId: data.auctionId, status: "accepted" },
    orderBy: { amount: "desc" },
    include: { bidder: { select: { name: true } } },
  });
  await broadcastAuction(data.auctionId, {
    highest: latest
      ? { amount: latest.amount.toString(), bidderName: publicBidderLabel(latest.bidder.name) }
      : null,
    bidId: data.bidId,
  });
}
