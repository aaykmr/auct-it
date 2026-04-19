import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser, requireVerifiedSeller } from "../lib/auth.js";

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(10),
  basePrice: z.coerce.number().positive(),
  categoryId: z.string().min(1, "categoryId is required"),
  cityIds: z.array(z.string().min(1)).min(1),
});

export async function registerListingRoutes(app: FastifyInstance) {
  app.post("/v1/listings", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const body = createSchema.parse(req.body);

    const [category, citiesFound] = await Promise.all([
      prisma.category.findUnique({ where: { id: body.categoryId } }),
      prisma.city.findMany({ where: { id: { in: body.cityIds } } }),
    ]);
    if (!category) {
      return reply.status(400).send({
        error: "Invalid categoryId",
        hint: "Run `pnpm --filter api exec prisma db seed` so categories exist, or pick a valid category from GET /v1/categories",
      });
    }
    if (citiesFound.length !== body.cityIds.length) {
      return reply.status(400).send({
        error: "One or more cityIds are invalid",
        hint: "Run `pnpm --filter api exec prisma db seed` so cities exist, or use ids from GET /v1/cities",
      });
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId,
        title: body.title,
        description: body.description,
        basePrice: body.basePrice,
        categoryId: body.categoryId,
        status: "draft",
        cities: {
          create: body.cityIds.map((cityId) => ({ cityId })),
        },
      },
      include: { cities: { include: { city: true } }, category: true },
    });
    return reply.send({ listing });
  });

  app.patch("/v1/listings/:id", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.coerce.number().positive().optional(),
        categoryId: z.string().optional(),
        cityIds: z.array(z.string()).optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
      })
      .parse(req.body);
    const existing = await prisma.listing.findFirst({ where: { id: params.id, sellerId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (body.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!cat) {
        return reply.status(400).send({ error: "Invalid categoryId", hint: "Use GET /v1/categories" });
      }
    }
    if (body.cityIds?.length) {
      const found = await prisma.city.findMany({ where: { id: { in: body.cityIds } } });
      if (found.length !== body.cityIds.length) {
        return reply.status(400).send({ error: "One or more cityIds are invalid", hint: "Use GET /v1/cities" });
      }
    }
    const listing = await prisma.listing.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        basePrice: body.basePrice,
        categoryId: body.categoryId,
        status: body.status,
        ...(body.cityIds
          ? {
              cities: { deleteMany: {}, create: body.cityIds.map((cityId) => ({ cityId })) },
            }
          : {}),
      },
      include: { cities: { include: { city: true } }, category: true },
    });
    return reply.send({ listing });
  });

  app.get("/v1/listings/mine", { preHandler: requireUser }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(12),
      })
      .parse(req.query);
    const skip = (q.page - 1) * q.pageSize;

    const where = { sellerId };
    const [total, rows] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: {
          category: true,
          cities: { include: { city: true } },
          auctions: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: q.pageSize,
      }),
    ]);
    const listings = rows.map((row) => {
      const coverImageUrl = row.images[0]?.url ?? null;
      const { images, ...rest } = row;
      return { ...rest, coverImageUrl };
    });
    return reply.send({
      listings,
      total,
      page: q.page,
      pageSize: q.pageSize,
    });
  });
}
