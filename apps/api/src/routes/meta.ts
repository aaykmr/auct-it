import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getCityHintForIp, getClientIp } from "../lib/geo-hint.js";

export async function registerMetaRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/v1/geo/city-hint", async (req, reply) => {
    const ip = getClientIp(req);
    const result = await getCityHintForIp(ip);
    return reply.send({
      cityId: result.cityId,
      city: result.city,
      created: result.created,
      source: result.source,
    });
  });

  app.get("/v1/categories", async () => {
    const rows = await prisma.category.findMany({ orderBy: { name: "asc" } });
    return { categories: rows };
  });

  app.get("/v1/cities", async () => {
    const rows = await prisma.city.findMany({ orderBy: { name: "asc" } });
    return { cities: rows };
  });
}
