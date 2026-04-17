import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dest = process.env.API_PROXY_TARGET?.trim() || "http://127.0.0.1:4000";
    return [{ source: "/v1/:path*", destination: `${dest}/v1/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      // Direct S3 virtual-hosted URL (when API omits S3_PUBLIC_BASE_URL)
      { protocol: "https", hostname: "auct-it-img.s3.ap-south-1.amazonaws.com", pathname: "/**" },
      // Add your CloudFront (or custom) hostname here when using S3_PUBLIC_BASE_URL in the API, e.g.:
      // { protocol: "https", hostname: "d111111abcdef8.cloudfront.net", pathname: "/**" },
    ],
  },
};

export default nextConfig;
