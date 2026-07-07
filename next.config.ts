import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Prisma to work on Vercel (serverless environment)
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
