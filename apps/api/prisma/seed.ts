import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { slug: "sneakers", name: "Sneakers" },
    { slug: "electronics", name: "Electronics" },
    { slug: "collectibles", name: "Collectibles" },
    { slug: "fashion", name: "Fashion" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  const cities = [
    { name: "Mumbai", state: "MH", normalizedName: "mumbai" },
    { name: "Bengaluru", state: "KA", normalizedName: "bengaluru" },
    { name: "Delhi", state: "DL", normalizedName: "delhi" },
    { name: "Hyderabad", state: "TG", normalizedName: "hyderabad" },
  ];
  for (const city of cities) {
    await prisma.city.upsert({
      where: { normalizedName: city.normalizedName },
      update: {},
      create: city,
    });
  }

  const helpCats = [
    { slug: "bidding", title: "Bidding", sortOrder: 1 },
    { slug: "payments", title: "Payments", sortOrder: 2 },
    { slug: "visits", title: "Visits & pickup", sortOrder: 3 },
    { slug: "disputes", title: "Disputes", sortOrder: 4 },
    { slug: "account", title: "Account", sortOrder: 5 },
  ];
  for (const hc of helpCats) {
    await prisma.helpCategory.upsert({
      where: { slug: hc.slug },
      update: { title: hc.title, sortOrder: hc.sortOrder },
      create: hc,
    });
  }

  const bidding = await prisma.helpCategory.findUniqueOrThrow({ where: { slug: "bidding" } });
  await prisma.helpArticle.upsert({
    where: { categoryId_slug: { categoryId: bidding.id, slug: "how-bidding-works" } },
    update: {},
    create: {
      categoryId: bidding.id,
      slug: "how-bidding-works",
      title: "How bidding works",
      bodyMarkdown:
        "Place bids on live auctions. Your bid must beat the current highest bid by at least ₹0.01. Auctions end at the scheduled time.",
      keywords: "bid auction highest",
    },
  });

  const visits = await prisma.helpCategory.findUniqueOrThrow({ where: { slug: "visits" } });
  await prisma.helpArticle.upsert({
    where: { categoryId_slug: { categoryId: visits.id, slug: "visit-fee" } },
    update: {},
    create: {
      categoryId: visits.id,
      slug: "visit-fee",
      title: "Visit fee (₹25)",
      bodyMarkdown:
        "Pay ₹25 to unlock the exact address and time for a seller inspection slot. Until then, only the general area is shown.",
      keywords: "visit fee address",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
