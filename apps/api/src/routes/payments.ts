import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../lib/auth.js";

function verifyCashfreeSignature(body: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const h = createHmac("sha256", secret).update(body).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(h), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function registerPaymentRoutes(app: FastifyInstance) {
  app.post("/v1/payments/cashfree/order", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const body = z
      .object({
        auctionId: z.string(),
        amount: z.coerce.number().positive(),
      })
      .parse(req.body);
    const idempotencyKey = `win-${body.auctionId}-${userId}`;
    const order =
      (await prisma.paymentOrder.findUnique({ where: { idempotencyKey } })) ??
      (await prisma.paymentOrder.create({
        data: {
          userId,
          kind: "auction_win",
          auctionId: body.auctionId,
          amount: body.amount,
          idempotencyKey,
          status: "created",
        },
      }));
    const cfOrderId = `cf_${order.id}`;
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        cfOrderId,
        status: "pending",
        metadata: { returnUrl: `${env.PUBLIC_WEB_URL}/payments/return` },
      },
    });
    return reply.send({
      paymentOrder: updated,
      cashfree: {
        orderId: cfOrderId,
        orderAmount: body.amount,
        orderCurrency: "INR",
        note: "Stub: use Cashfree server APIs to create session and redirect",
      },
    });
  });

  app.post("/v1/webhooks/cashfree", async (req, reply) => {
    const raw = JSON.stringify(req.body ?? {});
    const sig = req.headers["x-cashfree-signature"] as string | undefined;
    if (env.CASHFREE_WEBHOOK_SECRET) {
      if (!verifyCashfreeSignature(raw, sig, env.CASHFREE_WEBHOOK_SECRET)) {
        return reply.status(401).send({ error: "Invalid signature" });
      }
    }
    const parsed = z.object({ orderId: z.string().optional(), data: z.record(z.unknown()).optional() }).safeParse(req.body);
    if (!parsed.success) {
      return reply.send({ ok: true });
    }
    return reply.send({ ok: true, received: true });
  });
}
