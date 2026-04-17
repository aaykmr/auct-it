import type { FastifyBaseLogger } from "fastify";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not set");
  }
  if (!client) {
    const id = env.AWS_ACCESS_KEY_ID;
    const secret = env.AWS_SECRET_ACCESS_KEY;
    const useStaticKeys = Boolean(id && secret);
    client = new S3Client({
      region: env.AWS_REGION,
      ...(useStaticKeys
        ? {
            credentials: {
              accessKeyId: id!,
              secretAccessKey: secret!,
            },
          }
        : {}),
    });
  }
  return client;
}

/**
 * Public URL stored on `ListingImage.url` and returned to clients.
 * Prefer **`S3_PUBLIC_BASE_URL`** (e.g. your **CloudFront** distribution `https://dxxxx.cloudfront.net`
 * or custom domain) so images are served from CDN at the edge; omit trailing slash.
 * If unset, falls back to the S3 virtual-hosted–style URL for the bucket.
 */
export function publicUrlForKey(key: string): string {
  const base = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  if (base) return `${base}/${key}`;
  return `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function putListingObject(
  key: string,
  body: Buffer,
  contentType: string,
  log?: FastifyBaseLogger,
): Promise<string> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(env.S3_OBJECT_ACL === "public-read" ? { ACL: "public-read" as const } : {}),
    }),
  );
  log?.info(
    { bucket: env.S3_BUCKET, key, bytes: body.length, region: env.AWS_REGION },
    "listing image uploaded to S3",
  );
  return publicUrlForKey(key);
}
