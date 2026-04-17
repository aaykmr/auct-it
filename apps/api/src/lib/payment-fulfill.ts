import { createHash, randomBytes } from "node:crypto";
import type { PaymentOrder, Prisma } from "@prisma/client";
import { prisma } from "../db.js";

/** After a successful Cashfree payment for `visit_fee`, upsert visit fee row and access token. */
export async function fulfillVisitFeeAfterPayment(
  tx: Prisma.TransactionClient,
  order: PaymentOrder,
): Promise<void> {
  const slotId = (order.metadata as { slotId?: string })?.slotId;
  if (!slotId) return;
  const buyerId = order.userId;
  await tx.visitFeeOrder.upsert({
    where: { paymentOrderId: order.id },
    update: { status: "paid", paidAt: new Date() },
    create: {
      buyerId,
      slotId,
      amountInr: order.amount,
      paymentOrderId: order.id,
      status: "paid",
      paidAt: new Date(),
    },
  });
  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await tx.visitAccessToken.upsert({
    where: { slotId_buyerId: { slotId, buyerId } },
    update: {
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revealedAt: new Date(),
    },
    create: {
      slotId,
      buyerId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revealedAt: new Date(),
    },
  });
}

export async function processSuccessfulPaymentOrder(
  orderId: string,
  cfPaymentId: string | null,
  rawPayload: Prisma.InputJsonValue | undefined,
): Promise<void> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) return;

  await prisma.$transaction(async (tx) => {
    const u = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { not: "paid" } },
      data: { status: "paid" },
    });
    if (u.count === 0) return;

    await tx.paymentTransaction.create({
      data: {
        paymentOrderId: order.id,
        cfPaymentId,
        signatureVerified: true,
        status: "SUCCESS",
        paidAt: new Date(),
        rawPayload: rawPayload ?? undefined,
      },
    });

    if (order.kind === "visit_fee") {
      await fulfillVisitFeeAfterPayment(tx, order);
    }
  });
}

export async function processFailedPaymentOrder(
  orderId: string,
  rawPayload: Prisma.InputJsonValue | undefined,
): Promise<void> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status === "paid") return;
  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: "failed" },
  });
  await prisma.paymentTransaction.create({
    data: {
      paymentOrderId: order.id,
      cfPaymentId: null,
      signatureVerified: true,
      status: "FAILED",
      rawPayload: rawPayload ?? undefined,
    },
  });
}
