import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { createCashfreePgOrder, getCashfreePgOrder, verifyCashfreeWebhookSignature } from "../lib/cashfree.js";
import { processFailedPaymentOrder, processSuccessfulPaymentOrder } from "../lib/payment-fulfill.js";
import { requireUser } from "../lib/auth.js";

function verifyLegacyCashfreeBodySignature(body: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const h = createHmac("sha256", secret).update(body).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(h), Buffer.from(signature));
  } catch {
    return false;
  }
}

function phone10Digits(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "9999999999";
}

type WebhookPayload = {
  type?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { payment_status?: string; cf_payment_id?: string };
  };
};

function extractMerchantOrderId(payload: WebhookPayload): string | null {
  const id = payload.data?.order?.order_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function registerPaymentRoutes(app: FastifyInstance) {
  app.get("/v1/payments/orders/:id", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const q = z.object({ reconcile: z.string().optional() }).parse(req.query);
    const doReconcile =
      q.reconcile === "1" || q.reconcile === "true" || q.reconcile === "yes";

    let order = await prisma.paymentOrder.findFirst({
      where: { id: params.id, userId },
    });
    if (!order) return reply.status(404).send({ error: "Not found" });

    /** Local dev: Cashfree cannot POST webhooks to localhost — sync from PG after return_url redirect. */
    if (
      doReconcile &&
      order.status === "pending" &&
      env.CASHFREE_APP_ID &&
      env.CASHFREE_SECRET_KEY
    ) {
      try {
        const cf = await getCashfreePgOrder(order.id);
        if (cf.orderStatus === "PAID") {
          await processSuccessfulPaymentOrder(order.id, null, {
            source: "cashfree_pg_get_order",
            ...cf.raw,
          });
        }
        const refreshed = await prisma.paymentOrder.findFirst({
          where: { id: params.id, userId },
        });
        if (refreshed) order = refreshed;
      } catch (e) {
        req.log.warn({ err: e }, "Cashfree reconcile failed; returning stored order");
      }
    }

    return reply.send({
      order: {
        id: order.id,
        kind: order.kind,
        status: order.status,
        amount: order.amount.toString(),
        currency: order.currency,
        cfOrderId: order.cfOrderId,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  });

  app.post("/v1/payments/cashfree/order", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const body = z
      .object({
        auctionId: z.string(),
        amount: z.coerce.number().positive(),
      })
      .parse(req.body);
    const idempotencyKey = `win-${body.auctionId}-${userId}`;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: "Not found" });
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
    const returnUrl = `${env.PUBLIC_WEB_URL}/payments/return?order_id={order_id}`;
    const notifyUrl = `${env.PUBLIC_API_URL.replace(/\/$/, "")}/v1/webhooks/cashfree`;
    let updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "pending",
        metadata: { returnUrl, notifyUrl, auctionId: body.auctionId },
      },
    });
    try {
      const cf = await createCashfreePgOrder({
        orderId: order.id,
        orderAmount: body.amount,
        customerId: user.id,
        customerPhone: phone10Digits(user.mobileNumber),
        customerName: user.name?.trim().length ? user.name.trim() : "Buyer",
        returnUrl,
        notifyUrl,
        orderNote: "Auction win",
      });
      updated = await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          cfOrderId: cf.cfOrderId || order.id,
          metadata: {
            returnUrl,
            notifyUrl,
            auctionId: body.auctionId,
            paymentSessionId: cf.paymentSessionId,
            cashfreeOrderId: cf.cfOrderId,
          },
        },
      });
      return reply.send({
        paymentOrder: updated,
        cashfree: {
          paymentSessionId: cf.paymentSessionId,
          orderAmount: body.amount,
          orderCurrency: "INR",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cashfree error";
      return reply.status(502).send({
        error: msg,
        paymentOrder: updated,
        cashfree: null as null,
      });
    }
  });

  app.post("/v1/webhooks/cashfree", async (req, reply) => {
    const reqWithRaw = req as FastifyRequest & { rawBody?: string };
    const raw = reqWithRaw.rawBody ?? JSON.stringify(req.body ?? {});
    const sig = req.headers["x-webhook-signature"] as string | undefined;
    const ts = req.headers["x-webhook-timestamp"] as string | undefined;
    const legacySig = req.headers["x-cashfree-signature"] as string | undefined;

    let verified = false;
    if (env.CASHFREE_SECRET_KEY && sig && ts) {
      verified = verifyCashfreeWebhookSignature(sig, raw, ts, env.CASHFREE_SECRET_KEY);
    }
    if (!verified && env.CASHFREE_WEBHOOK_SECRET && legacySig) {
      verified = verifyLegacyCashfreeBodySignature(raw, legacySig, env.CASHFREE_WEBHOOK_SECRET);
    }
    if (env.CASHFREE_SECRET_KEY || env.CASHFREE_WEBHOOK_SECRET) {
      if (!verified) {
        return reply.status(401).send({ error: "Invalid signature" });
      }
    }

    const payload = (typeof req.body === "object" && req.body !== null ? req.body : {}) as WebhookPayload;
    const orderId = extractMerchantOrderId(payload);
    const type = payload.type ?? "";
    const paymentStatus = payload.data?.payment?.payment_status ?? "";
    const cfPaymentId = payload.data?.payment?.cf_payment_id
      ? String(payload.data.payment.cf_payment_id)
      : null;

    if (orderId && type === "PAYMENT_SUCCESS_WEBHOOK" && paymentStatus === "SUCCESS") {
      await processSuccessfulPaymentOrder(orderId, cfPaymentId, payload as object);
    } else if (orderId && (type === "PAYMENT_FAILED_WEBHOOK" || paymentStatus === "FAILED")) {
      await processFailedPaymentOrder(orderId, payload as object);
    }

    return reply.send({ ok: true });
  });
}
