import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

const PG_API_VERSION = "2022-09-01";

export function cashfreePgBaseUrl(): string {
  return env.cashfreeSandbox ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
}

export type CreatePgOrderInput = {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  returnUrl: string;
  notifyUrl: string;
  orderNote?: string;
};

export type CreatePgOrderResult = {
  cfOrderId: string;
  paymentSessionId: string;
  orderStatus?: string;
};

export async function createCashfreePgOrder(input: CreatePgOrderInput): Promise<CreatePgOrderResult> {
  const appId = env.CASHFREE_APP_ID;
  const secret = env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) {
    throw new Error("Cashfree is not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)");
  }
  const body = {
    order_id: input.orderId,
    order_amount: input.orderAmount,
    order_currency: input.orderCurrency ?? "INR",
    customer_details: {
      customer_id: input.customerId.slice(0, 50),
      customer_phone: input.customerPhone,
      customer_name: input.customerName.slice(0, 100),
      customer_email: input.customerEmail ?? `${input.customerId.slice(0, 40)}@buyer.auctit.local`,
    },
    order_meta: {
      return_url: input.returnUrl,
      notify_url: input.notifyUrl,
    },
    ...(input.orderNote ? { order_note: input.orderNote } : {}),
  };
  const res = await fetch(`${cashfreePgBaseUrl()}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": PG_API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secret,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : res.statusText;
    throw new Error(`Cashfree create order failed: ${msg}`);
  }
  const cfOrderId = String(json.cf_order_id ?? "");
  const paymentSessionId = String(json.payment_session_id ?? "");
  if (!paymentSessionId) {
    throw new Error("Cashfree response missing payment_session_id");
  }
  return {
    cfOrderId,
    paymentSessionId,
    orderStatus: typeof json.order_status === "string" ? json.order_status : undefined,
  };
}

/** Fetch order from Cashfree PG by **merchant** `order_id` (the id you passed at create — we use `PaymentOrder.id`). */
export async function createCashfreePgRefund(
  merchantOrderId: string,
  refundAmount: number,
  idempotencyKey: string,
): Promise<{ refundId: string; refundStatus: string; raw: Record<string, unknown> }> {
  const appId = env.CASHFREE_APP_ID;
  const secret = env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) {
    throw new Error("Cashfree is not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)");
  }
  const path = encodeURIComponent(merchantOrderId);
  const res = await fetch(`${cashfreePgBaseUrl()}/orders/${path}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": PG_API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secret,
      "x-idempotency-key": idempotencyKey.slice(0, 128),
    },
    body: JSON.stringify({
      refund_amount: refundAmount,
      refund_note: "Visit fee refund — slot cancelled",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : res.statusText;
    throw new Error(`Cashfree refund failed: ${msg}`);
  }
  const refundId = String(json.refund_id ?? json.cf_refund_id ?? "");
  const refundStatus = String(json.refund_status ?? json.status ?? "");
  return { refundId, refundStatus, raw: json };
}

export async function getCashfreePgOrder(merchantOrderId: string): Promise<{
  orderStatus: string;
  orderId: string;
  cfOrderId: string;
  raw: Record<string, unknown>;
}> {
  const appId = env.CASHFREE_APP_ID;
  const secret = env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) {
    throw new Error("Cashfree is not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)");
  }
  const path = encodeURIComponent(merchantOrderId);
  const res = await fetch(`${cashfreePgBaseUrl()}/orders/${path}`, {
    method: "GET",
    headers: {
      "x-api-version": PG_API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secret,
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : res.statusText;
    throw new Error(`Cashfree get order failed: ${msg}`);
  }
  const orderStatus = String(json.order_status ?? "");
  return {
    orderStatus,
    orderId: String(json.order_id ?? merchantOrderId),
    cfOrderId: String(json.cf_order_id ?? ""),
    raw: json,
  };
}

/** Cashfree PG webhook verification: `Base64(HMAC_SHA256(secret, timestamp + rawBody))`. */
export function verifyCashfreeWebhookSignature(
  signature: string | undefined,
  rawBody: string,
  timestamp: string | undefined,
  secretKey: string,
): boolean {
  if (!signature || !timestamp) return false;
  const signed = `${timestamp}${rawBody}`;
  const h = createHmac("sha256", secretKey).update(signed).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(h), Buffer.from(signature));
  } catch {
    return false;
  }
}
