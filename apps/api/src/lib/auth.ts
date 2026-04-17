import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { env } from "../env.js";

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function requireVerifiedSeller(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!env.requireSellerKyc) return;
  const sub = (req.user as { sub: string }).sub;
  const kyc = await prisma.sellerKycProfile.findUnique({ where: { userId: sub } });
  if (!kyc || kyc.status !== "verified") {
    return reply.status(403).send({ error: "Seller KYC must be verified" });
  }
}
