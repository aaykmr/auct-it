import { Redis } from "ioredis";
import { env } from "./env.js";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.on("error", (err: Error) => {
      console.warn("[redis]", err.message);
    });
    return client;
  } catch {
    return null;
  }
}
