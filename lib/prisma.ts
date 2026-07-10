import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Support multiple env var names - works with manual setup AND
// Vercel-Supabase integration (which sets POSTGRES_PRISMA_URL)
const datasourceUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

// FIX: Throw error instead of silent fail
if (!datasourceUrl) {
  throw new Error(
    "❌ CRITICAL: No database URL found. Please set one of these environment variables in Vercel:\n" +
      "  - POSTGRES_PRISMA_URL (recommended for Vercel-Supabase integration)\n" +
      "  - DATABASE_URL (standard PostgreSQL connection string)\n" +
      "  - POSTGRES_URL (alternative)"
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
