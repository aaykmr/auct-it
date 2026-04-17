import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../lib/auth.js";

const submitSchema = z.object({
  legalName: z.string().min(2),
  idType: z.string().min(2),
  idNumber: z.string().min(4),
  bankAccount: z.object({
    accountNumber: z.string().min(4),
    ifsc: z.string().min(4),
    holderName: z.string().min(2),
  }),
});

export async function registerKycRoutes(app: FastifyInstance) {
  app.post("/v1/kyc", { preHandler: [requireUser] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const body = submitSchema.parse(req.body);
    const idNumberHash = createHash("sha256").update(body.idNumber).digest("hex");
    const profile = await prisma.sellerKycProfile.upsert({
      where: { userId },
      update: {
        legalName: body.legalName,
        idType: body.idType,
        idNumberHash,
        bankDetails: body.bankAccount,
        status: "pending",
      },
      create: {
        userId,
        legalName: body.legalName,
        idType: body.idType,
        idNumberHash,
        bankDetails: body.bankAccount,
        status: "pending",
      },
    });
    await prisma.sellerKycEvent.create({
      data: {
        sellerId: profile.id,
        action: "submitted",
        actor: "user",
        metadata: {},
      },
    });
    return reply.send({ profile });
  });

  app.post("/v1/admin/kyc/:userId/verify", async (req, reply) => {
    const secret = req.headers["x-admin-secret"];
    if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const params = z.object({ userId: z.string() }).parse(req.params);
    const body = z.object({ status: z.enum(["verified", "rejected"]), reason: z.string().optional() }).parse(req.body);
    const profile = await prisma.sellerKycProfile.findUnique({ where: { userId: params.userId } });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    const updated = await prisma.sellerKycProfile.update({
      where: { id: profile.id },
      data: {
        status: body.status,
        reviewedAt: new Date(),
      },
    });
    await prisma.sellerKycEvent.create({
      data: {
        sellerId: profile.id,
        action: `admin_${body.status}`,
        actor: "admin",
        reason: body.reason,
        metadata: {},
      },
    });
    return reply.send({ profile: updated });
  });
}
