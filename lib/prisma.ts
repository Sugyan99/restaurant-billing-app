import { PrismaClient, Prisma } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Append serverless-safe parameters to a database URL:
 *   connection_limit=3    – cap connections per lambda instance
 *   pool_timeout=15       – wait up to 15s for a free slot
 *   connect_timeout=15    – wait up to 15s on initial connect (DB wakeup)
 *   socket_timeout=30     – drop idle sockets after 30s
 *
 * For pgBouncer URLs (port 6543) also add pgbouncer=true.
 */
function buildUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", "3");
    if (!u.searchParams.has("pool_timeout"))
      u.searchParams.set("pool_timeout", "15");
    if (!u.searchParams.has("connect_timeout"))
      u.searchParams.set("connect_timeout", "15");
    // If the URL targets the Supabase pooler port, enable pgBouncer mode
    if (u.port === "6543" && !u.searchParams.has("pgbouncer"))
      u.searchParams.set("pgbouncer", "true");
    return u.toString();
  } catch {
    return raw; // malformed URL — return as-is, let Prisma surface the error
  }
}

// ── Admin client (postgres superuser — bypasses RLS) ─────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!rawUrl) {
  console.error("❌ No database URL found. Set DATABASE_URL or POSTGRES_PRISMA_URL.");
}

const datasourceUrl = buildUrl(rawUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV !== "production" ? ["error"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ── App client (prisma_app role — subject to RLS) ────────────────────────────

const globalForPrismaApp = globalThis as unknown as {
  prismaApp: PrismaClient | undefined;
};

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

if (process.env.NODE_ENV !== "production") {
  globalForPrismaApp.prismaApp = prismaApp;
}

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
