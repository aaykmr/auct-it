import { prisma } from "../db.js";

export async function resolveAuctionIfEnded(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { listing: true },
  });
  if (!auction || auction.status === "ended" || auction.status === "cancelled") {
    return auction;
  }
  const now = new Date();
  if (now <= auction.endAt) return auction;

  const top = await prisma.bid.findFirst({
    where: { auctionId, status: "accepted" },
    orderBy: { amount: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: { status: "ended", winnerBidId: top?.id ?? null },
    });
    if (top) {
      await tx.orderFulfillment.upsert({
        where: { auctionId },
        update: {},
        create: {
          auctionId,
          buyerId: top.bidderId,
          sellerId: auction.listing.sellerId,
          mode: "pickup",
          status: "pending",
        },
      });
      await tx.sellerPayout.upsert({
        where: { auctionId },
        update: {},
        create: {
          auctionId,
          sellerId: auction.listing.sellerId,
          payoutAmount: top.amount,
          status: "held",
          releaseTrigger: "fulfillment_verified",
        },
      });
    }
  });

  return prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      listing: {
        include: {
          category: true,
          cities: { include: { city: true } },
          seller: { select: { id: true, name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      bids: {
        where: { status: "accepted" },
        orderBy: { amount: "desc" },
        take: 1,
        include: { bidder: { select: { id: true, name: true, mobileNumber: true } } },
      },
    },
  });
}
