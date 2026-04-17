import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function registerMetaRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/v1/categories", async () => {
    const rows = await prisma.category.findMany({ orderBy: { name: "asc" } });
    return { categories: rows };
  });

  app.get("/v1/cities", async () => {
    const rows = await prisma.city.findMany({ orderBy: { name: "asc" } });
    return { cities: rows };
  });
}
