import { PrismaClient, Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// URL transformer
//
// Supabase direct connections (db.PROJECT.supabase.co:5432) are IPv6-first and
// can fail from Vercel's IPv4-only runtime. Rewrite direct URLs to the shared
// Supavisor session pooler in the project's region. Session mode is intentional
// here because withTenant() uses Prisma interactive transactions.
// ─────────────────────────────────────────────────────────────────────────────
function buildUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);

    // Detect direct Supabase URL: db.PROJECT_REF.supabase.co port 5432
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (m && (u.port === "5432" || u.port === "")) {
      const ref = m[1];
      u.hostname = "aws-1-ap-south-1.pooler.supabase.com";
      u.port = "5432";
      if (!u.username.includes(".")) {
        u.username = `${u.username}.${ref}`;
      }
      console.log(`[prisma] ✅ Rewrote direct URL → session pooler (ref=${ref})`);
    }

    // Vercel/serverless safety: keep one DB connection per Prisma client.
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("pool_timeout"))
      u.searchParams.set("pool_timeout", "20");
    if (!u.searchParams.has("connect_timeout"))
      u.searchParams.set("connect_timeout", "20");

    return u.toString();
  } catch {
    return raw;
  }
}

// ── Admin client ──────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const rawUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!rawUrl) {
  console.error("❌ No database URL found. Set DATABASE_URL or POSTGRES_PRISMA_URL.");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildUrl(rawUrl),
    log: process.env.NODE_ENV !== "production" ? ["error"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ── App client (RLS-enforced) ─────────────────────────────────────────────────
const globalForPrismaApp = globalThis as unknown as { prismaApp: PrismaClient | undefined };

const rawAppUrl =
  process.env.APP_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

export const prismaApp =
  globalForPrismaApp.prismaApp ??
  new PrismaClient({
    datasourceUrl: buildUrl(rawAppUrl),
    log: process.env.NODE_ENV !== "production" ? ["error"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrismaApp.prismaApp = prismaApp;

// ── withTenant ────────────────────────────────────────────────────────────────
export async function withTenant<T>(
  tenantId: string,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (process.env.APP_DATABASE_URL) {
    return prismaApp.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid, ${userId})`;
      return fn(tx);
    });
  }
  return fn(prisma as unknown as Prisma.TransactionClient);
}
