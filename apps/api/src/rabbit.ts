import amqp from "amqplib";
import { env } from "./env.js";

export const BIDS_QUEUE = "bids.incoming";

let channel: amqp.Channel | null = null;

export async function getRabbitChannel(): Promise<amqp.Channel | null> {
  if (channel) return channel;
  try {
    const conn = await amqp.connect(env.RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(BIDS_QUEUE, { durable: true });
    channel = ch;
    return ch;
  } catch (e) {
    console.warn("[rabbitmq] unavailable:", e);
    return null;
  }
}

export async function publishBidMessage(payload: object): Promise<boolean> {
  const ch = await getRabbitChannel();
  if (!ch) return false;
  ch.sendToQueue(BIDS_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: "application/json",
  });
  return true;
}
