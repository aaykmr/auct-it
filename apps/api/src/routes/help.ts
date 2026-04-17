import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

export async function registerHelpRoutes(app: FastifyInstance) {
  app.get("/v1/help/categories", async (_req, reply) => {
    const categories = await prisma.helpCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        articles: { where: { published: true }, orderBy: { title: "asc" }, select: { id: true, slug: true, title: true } },
      },
    });
    return reply.send({ categories });
  });

  app.get("/v1/help/articles/:categorySlug/:articleSlug", async (req, reply) => {
    const params = z.object({ categorySlug: z.string(), articleSlug: z.string() }).parse(req.params);
    const category = await prisma.helpCategory.findUnique({ where: { slug: params.categorySlug } });
    if (!category) return reply.status(404).send({ error: "Not found" });
    const article = await prisma.helpArticle.findFirst({
      where: { categoryId: category.id, slug: params.articleSlug, published: true },
    });
    if (!article) return reply.status(404).send({ error: "Not found" });
    return reply.send({ article });
  });

  app.get("/v1/help/search", async (req, reply) => {
    const q = z.object({ q: z.string().min(1) }).parse(req.query);
    const articles = await prisma.helpArticle.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { keywords: { contains: q.q, mode: "insensitive" } },
          { bodyMarkdown: { contains: q.q, mode: "insensitive" } },
        ],
      },
      take: 20,
      include: { category: true },
    });
    return reply.send({ articles });
  });
}
