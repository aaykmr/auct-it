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

/** Verifies JWT when `Authorization: Bearer` is present; otherwise leaves `req.user` unset. */
export async function optionalUser(
  req: FastifyRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Fastify preHandler signature
  _reply: FastifyReply,
) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return;
  try {
    await req.jwtVerify();
  } catch {
    /* invalid or expired token — treat as anonymous */
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
