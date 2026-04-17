import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { putListingObject } from "../lib/s3-upload.js";
import { requireVerifiedSeller } from "../lib/auth.js";

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

export async function registerListingImageRoutes(app: FastifyInstance) {
  app.post("/v1/listings/:id/images", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    if (!env.S3_BUCKET) {
      req.log.warn("listing images: S3_BUCKET is not set");
      return reply.status(503).send({
        error: "Image uploads are not configured",
        hint:
          "Set S3_BUCKET in apps/api/.env. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for local dev, or use ~/.aws/credentials / IAM instance profile and omit keys. Optionally set S3_PUBLIC_BASE_URL (CloudFront). Restart the API after changing .env.",
      });
    }
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string() }).parse(req.params);
    const listing = await prisma.listing.findFirst({ where: { id: params.id, sellerId } });
    if (!listing) return reply.status(404).send({ error: "Listing not found" });

    if (!req.isMultipart()) {
      req.log.warn({ listingId: listing.id }, "listing images: request is not multipart");
      return reply.status(400).send({ error: "Multipart form required" });
    }

    const existing = await prisma.listingImage.count({ where: { listingId: listing.id } });
    let sortBase = existing;
    const uploaded: { id: string; url: string; width: number | null; height: number | null }[] = [];

    let skippedNonFile = 0;
    let skippedField = 0;
    let skippedMime = 0;
    let skippedMaxFiles = 0;
    let skippedTooLarge = 0;
    let sharpFailures = 0;

    for await (const part of req.parts()) {
      if (part.type !== "file") {
        skippedNonFile += 1;
        continue;
      }
      if (part.fieldname !== "files" && part.fieldname !== "file") {
        skippedField += 1;
        continue;
      }
      if (!part.mimetype?.startsWith("image/")) {
        skippedMime += 1;
        req.log.warn(
          { listingId: listing.id, fieldname: part.fieldname, mimetype: part.mimetype },
          "listing images: skipped part (not an image/* type)",
        );
        continue;
      }
      if (sortBase >= MAX_FILES) {
        skippedMaxFiles += 1;
        break;
      }

      const raw = await part.toBuffer();
      if (raw.length > MAX_BYTES) {
        skippedTooLarge += 1;
        req.log.warn(
          { listingId: listing.id, bytes: raw.length, maxBytes: MAX_BYTES },
          "listing images: skipped file (over size limit)",
        );
        continue;
      }

      let buf: Buffer;
      let width: number | null = null;
      let height: number | null = null;
      try {
        const out = await sharp(raw)
          .rotate()
          .resize({
            width: 1080,
            height: 1080,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer({ resolveWithObject: true });
        buf = out.data;
        width = out.info.width ?? null;
        height = out.info.height ?? null;
      } catch (err) {
        sharpFailures += 1;
        req.log.warn({ err, listingId: listing.id, mimetype: part.mimetype }, "listing images: sharp processing failed");
        continue;
      }

      const key = `listings/${listing.id}/${randomUUID()}.webp`;
      let url: string;
      try {
        url = await putListingObject(key, buf, "image/webp", req.log);
      } catch (err) {
        req.log.error(
          { err, listingId: listing.id, key, bucket: env.S3_BUCKET, region: env.AWS_REGION },
          "listing images: S3 PutObject failed",
        );
        throw err;
      }

      const row = await prisma.listingImage.create({
        data: {
          listingId: listing.id,
          url,
          sortOrder: sortBase,
          width,
          height,
        },
      });
      uploaded.push({ id: row.id, url, width, height });
      sortBase += 1;
    }

    if (uploaded.length === 0) {
      req.log.warn(
        {
          listingId: listing.id,
          skippedNonFile,
          skippedField,
          skippedMime,
          skippedMaxFiles,
          skippedTooLarge,
          sharpFailures,
        },
        "listing images: no images saved (see counts)",
      );
      return reply.status(400).send({
        error: "No valid images",
        hint: "Send image files under field name files (max 10, 10MB each)",
      });
    }

    return reply.send({ images: uploaded });
  });

  app.delete("/v1/listings/:id/images/:imageId", { preHandler: requireVerifiedSeller }, async (req, reply) => {
    const sellerId = (req.user as { sub: string }).sub;
    const params = z.object({ id: z.string(), imageId: z.string() }).parse(req.params);
    const listing = await prisma.listing.findFirst({ where: { id: params.id, sellerId } });
    if (!listing) return reply.status(404).send({ error: "Listing not found" });
    const img = await prisma.listingImage.findFirst({
      where: { id: params.imageId, listingId: listing.id },
    });
    if (!img) return reply.status(404).send({ error: "Image not found" });
    await prisma.listingImage.delete({ where: { id: img.id } });
    return reply.send({ ok: true });
  });
}
