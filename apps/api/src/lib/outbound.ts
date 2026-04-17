import { prisma } from "../db.js";
import { env } from "../env.js";

export type OutboundChannel = "sms" | "whatsapp";

function phone10Digits(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : mobile;
}

/**
 * Idempotent outbound SMS/WhatsApp. Logs to DB; when no provider keys are set, logs only (dev).
 */
export async function sendSlotCancelledNotice(input: {
  buyerId: string;
  toPhone: string;
  message: string;
  channels: OutboundChannel[];
}): Promise<void> {
  const to = phone10Digits(input.toPhone);
  for (const channel of input.channels) {
    const idempotencyKey = `slot-cancel:${input.buyerId}:${channel}:${to}`.slice(0, 200);
    const existing = await prisma.outboundMessageLog.findUnique({
      where: { idempotencyKey },
    });
    if (existing) continue;

    const configured =
      channel === "sms"
        ? Boolean(process.env.OUTBOUND_SMS_API_KEY?.trim())
        : Boolean(process.env.OUTBOUND_WHATSAPP_TOKEN?.trim());

    if (!configured) {
      console.info(`[outbound:${channel}] (noop) to=${to} ${input.message.slice(0, 120)}`);
    }

    await prisma.outboundMessageLog.create({
      data: {
        idempotencyKey,
        channel,
        toPhone: to,
        bodyPreview: input.message.slice(0, 500),
        status: configured ? "queued" : "noop",
      },
    });
  }
}

export function defaultPublicWebUrl(): string {
  return env.PUBLIC_WEB_URL.replace(/\/$/, "");
}
