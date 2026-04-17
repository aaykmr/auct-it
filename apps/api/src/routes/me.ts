import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../lib/auth.js";

const patchMeSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
});

export async function registerMeRoutes(app: FastifyInstance) {
  app.patch("/v1/me", { preHandler: requireUser }, async (req, reply) => {
    const sub = (req.user as { sub: string }).sub;
    const body = patchMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: sub },
      data: { name: body.name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    return reply.send({ user });
  });

  app.get("/v1/me/auctions/bidding", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(12),
      })
      .parse(req.query);
    const skip = (q.page - 1) * q.pageSize;

    const where = {
      bids: { some: { bidderId: userId, status: "accepted" as const } },
    };

    const [total, rows] = await Promise.all([
      prisma.auction.count({ where }),
      prisma.auction.findMany({
        where,
        include: {
          listing: {
            include: {
              category: true,
              cities: { include: { city: true } },
            },
          },
          bids: {
            where: { bidderId: userId, status: "accepted" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { endAt: "desc" },
        skip,
        take: q.pageSize,
      }),
    ]);

    const auctionIds = rows.map((a) => a.id);
    const acceptedBids =
      auctionIds.length === 0
        ? []
        : await prisma.bid.findMany({
            where: { auctionId: { in: auctionIds }, status: "accepted" },
            orderBy: { amount: "desc" },
            include: { bidder: { select: { id: true, name: true } } },
          });
    const topMap = new Map<string, (typeof acceptedBids)[0]>();
    for (const b of acceptedBids) {
      if (!topMap.has(b.auctionId)) topMap.set(b.auctionId, b);
    }

    const now = new Date();
    return reply.send({
      auctions: rows.map((a) => {
        const top = topMap.get(a.id);
        const mine = a.bids[0];
        const amIWinning = top?.bidderId === userId;
        const canCancel =
          amIWinning &&
          a.endAt > now &&
          a.status !== "ended" &&
          a.status !== "cancelled";
        return {
          id: a.id,
          endAt: a.endAt,
          status: a.status,
          currentBid: top?.amount.toString() ?? null,
          listing: {
            ...a.listing,
            basePrice: a.listing.basePrice.toString(),
          },
          myLatestBidAmount: mine?.amount.toString() ?? null,
          myLatestBidId: mine?.id ?? null,
          amIWinning,
          canCancel,
        };
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
    });
  });
}
