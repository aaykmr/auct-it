import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../lib/auth.js";

const mobileSchema = z.object({
  mobileNumber: z.string().min(10).max(15),
});

const verifySchema = mobileSchema.extend({
  otp: z.string().min(4).max(8),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/otp/request", async (req, reply) => {
    const body = mobileSchema.parse(req.body);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.otpSession.create({
      data: {
        mobileNumber: body.mobileNumber,
        otpCode: env.OTP_DUMMY_CODE,
        expiresAt,
      },
    });
    return reply.send({
      ok: true,
      expiresAt,
      ...(env.NODE_ENV === "development" ? { devOtp: env.OTP_DUMMY_CODE } : {}),
    });
  });

  app.post("/v1/auth/otp/verify", async (req, reply) => {
    const body = verifySchema.parse(req.body);
    const session = await prisma.otpSession.findFirst({
      where: { mobileNumber: body.mobileNumber, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!session || session.otpCode !== body.otp) {
      if (session) {
        await prisma.otpSession.update({
          where: { id: session.id },
          data: { attempts: { increment: 1 } },
        });
      }
      return reply.status(400).send({ error: "Invalid OTP" });
    }
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { verifiedAt: new Date() },
    });
    let user = await prisma.user.findUnique({ where: { mobileNumber: body.mobileNumber } });
    if (!user) {
      user = await prisma.user.create({
        data: { mobileNumber: body.mobileNumber },
      });
    }
    const token = await reply.jwtSign({ sub: user.id, mobile: user.mobileNumber });
    return reply.send({ token, user: { id: user.id, mobileNumber: user.mobileNumber, name: user.name } });
  });

  app.get("/v1/me", { preHandler: requireUser }, async (req, reply) => {
    const sub = (req.user as { sub: string }).sub;
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return reply.status(404).send({ error: "Not found" });
    const kyc = await prisma.sellerKycProfile.findUnique({ where: { userId: user.id } });
    return reply.send({ user, kyc });
  });
}
