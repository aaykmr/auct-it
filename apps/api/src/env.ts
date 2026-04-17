import { z } from "zod";

/** Treat missing, empty, or whitespace-only env values as undefined (avoids `KEY=""` breaking checks). */
const optionalTrimmed = z.preprocess(
  (v) => (v === undefined || v === null || String(v).trim() === "" ? undefined : String(v).trim()),
  z.string().optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  RABBITMQ_URL: z.string().default("amqp://auctit:auctit@127.0.0.1:5672"),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PUBLIC_WEB_URL: z.string().default("http://localhost:3000"),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_WEBHOOK_SECRET: z.string().optional(),
  ADMIN_SECRET: z.string().optional(),
  DISPUTE_WINDOW_HOURS: z.coerce.number().default(48),
  VISIT_FEE_INR: z.coerce.number().default(25),
  UPLOAD_DIR: z.string().default("./uploads"),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: optionalTrimmed,
  AWS_SECRET_ACCESS_KEY: optionalTrimmed,
  S3_BUCKET: optionalTrimmed,
  /**
   * **Recommended in production:** HTTPS origin for public image URLs (no trailing slash), e.g.
   * CloudFront `https://d111111abcdef8.cloudfront.net` or a custom domain pointing at the distribution.
   * Stored URLs and `next/image` remote patterns should use this host. If unset, the API uses the S3 bucket URL.
   */
  S3_PUBLIC_BASE_URL: optionalTrimmed,
  /**
   * Default `none`: no PutObject ACL (matches **ACLs disabled** / bucket owner enforced—AWS default for new buckets).
   * Use **bucket policy** `s3:GetObject` on `listings/*` for public URLs. Set `public-read` only if the bucket has ACLs enabled; IAM needs `s3:PutObjectAcl`.
   */
  S3_OBJECT_ACL: z.enum(["public-read", "none"]).default("none"),
  OTP_DUMMY_CODE: z.string().default("123456"),
  /** When unset: required only if `NODE_ENV` is `production`. Set `false` to skip KYC in local/dev. */
  REQUIRE_SELLER_KYC: z.enum(["true", "false"]).optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  /** Enforce verified seller KYC on listing/auction routes. */
  requireSellerKyc:
    parsed.REQUIRE_SELLER_KYC === "true"
      ? true
      : parsed.REQUIRE_SELLER_KYC === "false"
        ? false
        : parsed.NODE_ENV === "production",
};

export type Env = typeof env;
