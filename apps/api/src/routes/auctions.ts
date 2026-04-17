import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { resolveAuctionIfEnded } from "../lib/auction-resolve.js";
import { publicBidderLabel } from "../lib/public-bidder.js";
import { requireUser, requireVerifiedSeller } from "../lib/auth.js";

export async function registerAuctionRoutes(app: FastifyInstance) {
  app.post("/v1/listings/:listingId/auction", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ listingId: z.string() }).parse(req.params);
    const body = z
      .object({
        durationMinutes: z.coerce.number().int().min(5).max(10080),
        reservePrice: z.coerce.number().positive().optional(),
      })
      .parse(req.body);
    const listing = await prisma.listing.findFirst({
      where: { id: params.listingId, sellerId },
    });
    if (!listing) return reply.status(404).send({ error: "Listing not found" });
    if (listing.status !== "active") {
      return reply.status(400).send({ error: "Listing must be active to start auction" });
    }
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + body.durationMinutes * 60 * 1000);
    const auction = await prisma.auction.create({
      data: {
        listingId: listing.id,
        startAt,
        endAt,
        durationMinutes: body.durationMinutes,
        reservePrice: body.reservePrice,
        status: "live",
      },
      include: { listing: { include: { category: true, cities: { include: { city: true } } } } },
    });
    return reply.send({ auction });
  });

  app.get("/v1/auctions", async (req, reply) => {
    const q = z
      .object({
        cityIds: z.string().optional(),
        categoryId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);
    const cityIds = q.cityIds?.split(",").filter(Boolean) ?? [];
    const where: Prisma.AuctionWhereInput = {
      status: { in: ["live", "scheduled"] },
      endAt: { gt: new Date() },
      listing: {
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.search
          ? {
              OR: [
                { title: { contains: q.search, mode: "insensitive" } },
                { description: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(cityIds.length
          ? {
              cities: { some: { cityId: { in: cityIds } } },
            }
          : {}),
      },
    };
    const auctions = await prisma.auction.findMany({
      where,
      include: {
        listing: {
          include: {
            category: true,
            cities: { include: { city: true } },
            seller: { select: { id: true, name: true } },
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        bids: { where: { status: "accepted" }, orderBy: { amount: "desc" }, take: 1 },
      },
      orderBy: { endAt: "asc" },
      take: 48,
    });
    return reply.send({
      auctions: auctions.map((a) => {
        const { images, ...listingRest } = a.listing;
        return {
          ...a,
          currentBid: a.bids[0]?.amount?.toString() ?? null,
          listing: {
            ...listingRest,
            basePrice: a.listing.basePrice.toString(),
            coverImageUrl: images[0]?.url ?? null,
          },
        };
      }),
    });
  });

  app.get("/v1/auctions/:id", async (req, reply) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    await resolveAuctionIfEnded(params.id);
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          include: {
            category: true,
            cities: { include: { city: true } },
            seller: { select: { id: true, name: true } },
            images: { orderBy: { sortOrder: "asc" } },
          },
        },
        bids: {
          where: { status: "accepted" },
          orderBy: { amount: "desc" },
          take: 1,
          include: { bidder: { select: { name: true } } },
        },
      },
    });
    if (!auction) return reply.status(404).send({ error: "Not found" });
    const { bids, listing, ...auctionRest } = auction;
    const { images, ...listingRest } = listing;
    const imageUrls = images.map((img) => img.url);
    return reply.send({
      auction: {
        ...auctionRest,
        listing: {
          ...listingRest,
          basePrice: listing.basePrice.toString(),
          coverImageUrl: imageUrls[0] ?? null,
          imageUrls,
        },
        currentBid: bids[0]?.amount?.toString() ?? null,
      },
    });
  });

  app.get("/v1/auctions/:id/participation", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    await resolveAuctionIfEnded(params.id);
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { listing: { select: { id: true, sellerId: true } } },
    });
    if (!auction) return reply.status(404).send({ error: "Not found" });
    const fulfillment = await prisma.orderFulfillment.findUnique({
      where: { auctionId: params.id },
    });
    let role: "buyer" | "seller" | "none" = "none";
    if (auction.listing.sellerId === userId) role = "seller";
    if (fulfillment?.buyerId === userId) role = "buyer";
    return reply.send({
      role,
      fulfillment: fulfillment
        ? { id: fulfillment.id, status: fulfillment.status, mode: fulfillment.mode }
        : null,
    });
  });

  app.get("/v1/auctions/:id/bids/recent", async (req, reply) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const auction = await prisma.auction.findUnique({ where: { id: params.id } });
    if (!auction) return reply.status(404).send({ error: "Not found" });
    const bids = await prisma.bid.findMany({
      where: { auctionId: params.id, status: "accepted" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { bidder: { select: { name: true } } },
    });
    return reply.send({
      bids: bids.map((b) => ({
        id: b.id,
        amount: b.amount.toString(),
        createdAt: b.createdAt,
        bidder: publicBidderLabel(b.bidder.name),
      })),
    });
  });
}
