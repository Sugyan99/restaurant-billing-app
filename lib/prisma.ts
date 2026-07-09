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

if (!datasourceUrl) {
  console.error(
    "❌ No database URL found. Set DATABASE_URL or POSTGRES_PRISMA_URL in Vercel Environment Variables."
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
