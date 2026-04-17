import path from "node:path";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { ZodError } from "zod";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { mkdir } from "node:fs/promises";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { getRedis } from "./redis.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerKycRoutes } from "./routes/kyc.js";
import { registerListingImageRoutes } from "./routes/listing-images.js";
import { registerListingRoutes } from "./routes/listings.js";
import { registerAuctionRoutes } from "./routes/auctions.js";
import { registerBidRoutes } from "./routes/bids.js";
import { registerVisitRoutes } from "./routes/visits.js";
import { registerFulfillmentRoutes } from "./routes/fulfillment.js";
import { registerDisputeRoutes } from "./routes/disputes.js";
import { registerHelpRoutes } from "./routes/help.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerWsRoutes } from "./routes/ws.js";
import { zodErrorToClientMessage } from "./lib/validation-error.js";

export async function buildApp() {
  await mkdir(env.UPLOAD_DIR, { recursive: true });

  const app = Fastify({ logger: true });
  app.decorate("prisma", prisma);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [env.PUBLIC_WEB_URL, "http://localhost:3000"],
    credentials: true,
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  const redis = getRedis();
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    ...(redis ? { redis } : {}),
  });
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  });
  await app.register(websocket);
  await app.register(fastifyStatic, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: "/uploads/",
  });

  await registerMetaRoutes(app);
  await registerAuthRoutes(app);
  await registerMeRoutes(app);
  await registerKycRoutes(app);
  await registerListingRoutes(app);
  await registerListingImageRoutes(app);
  await registerAuctionRoutes(app);
  await registerBidRoutes(app);
  await registerVisitRoutes(app);
  await registerFulfillmentRoutes(app);
  await registerDisputeRoutes(app);
  await registerHelpRoutes(app);
  await registerPaymentRoutes(app);
  await registerWsRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({ error: zodErrorToClientMessage(error) });
      return;
    }
    void reply.send(error);
  });

  return app;
}
