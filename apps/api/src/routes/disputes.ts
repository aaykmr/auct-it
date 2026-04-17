import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireUser } from "../lib/auth.js";

export async function registerDisputeRoutes(app: FastifyInstance) {
  app.post("/v1/disputes", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    if (!req.isMultipart()) {
      return reply.status(400).send({ error: "Multipart form required" });
    }
    let fulfillmentId = "";
    let reasonCategory = "";
    let description = "";
    const media: { type: string; path: string }[] = [];
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    for await (const part of req.parts()) {
      if (part.type === "field") {
        if (part.fieldname === "fulfillmentId") fulfillmentId = String(part.value);
        if (part.fieldname === "reasonCategory") reasonCategory = String(part.value);
        if (part.fieldname === "description") description = String(part.value);
      } else if (part.type === "file") {
        const ext = path.extname(part.filename) || ".bin";
        const name = `${randomUUID()}${ext}`;
        const dest = path.join(env.UPLOAD_DIR, name);
        const buf = await part.toBuffer();
        await writeFile(dest, buf);
        const isVideo = part.mimetype?.startsWith("video/");
        media.push({ type: isVideo ? "video" : "photo", path: `/uploads/${name}` });
      }
    }
    if (!fulfillmentId || !reasonCategory || !description) {
      return reply.status(400).send({ error: "fulfillmentId, reasonCategory, description required" });
    }
    if (media.length === 0) {
      return reply.status(400).send({ error: "At least one photo or video is required" });
    }
    const fulfillment = await prisma.orderFulfillment.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) return reply.status(404).send({ error: "Fulfillment not found" });
    if (fulfillment.buyerId !== userId && fulfillment.sellerId !== userId) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    if (!fulfillment.completedAt || !fulfillment.disputeWindowEndsAt) {
      return reply.status(400).send({ error: "Fulfillment not completed" });
    }
    const now = new Date();
    if (now > fulfillment.disputeWindowEndsAt) {
      return reply.status(400).send({ error: "Dispute window closed" });
    }
    const dispute = await prisma.orderDispute.create({
      data: {
        fulfillmentId,
        raisedById: userId,
        reasonCategory,
        description,
        status: "open",
        media: {
          create: media.map((m) => ({
            mediaType: m.type,
            storageRef: m.path,
          })),
        },
      },
      include: { media: true },
    });
    await prisma.sellerPayout.updateMany({
      where: { auctionId: fulfillment.auctionId },
      data: { status: "on_hold" },
    });
    return reply.send({ dispute });
  });

  app.get("/v1/disputes/:id", { preHandler: requireUser }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const dispute = await prisma.orderDispute.findUnique({
      where: { id: params.id },
      include: { fulfillment: true, media: true },
    });
    if (!dispute) return reply.status(404).send({ error: "Not found" });
    if (
      dispute.raisedById !== userId &&
      dispute.fulfillment.buyerId !== userId &&
      dispute.fulfillment.sellerId !== userId
    ) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    return reply.send({ dispute });
  });
}
