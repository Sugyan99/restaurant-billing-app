import { PrismaClient, Prisma } from "@prisma/client";

// ── Admin client (postgres superuser — bypasses RLS) ──────────────────────────
// Use ONLY for: auth operations, migrations, super-admin tasks.
// NEVER use for tenant-scoped data queries.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!datasourceUrl) {
  console.error(
    "❌ No database URL found. Set DATABASE_URL or POSTGRES_PRISMA_URL."
  );
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ── App client (prisma_app role — subject to RLS) ─────────────────────────────
// Connects as a non-superuser role. All queries respect RLS policies.
// Must ALWAYS be used inside withTenant() so tenant context is set first.

const globalForPrismaApp = globalThis as unknown as {
  prismaApp: PrismaClient | undefined;
};

const appDatasourceUrl =
  process.env.APP_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||  // fallback for local dev (RLS not enforced locally)
  process.env.DATABASE_URL;

export const prismaApp =
  globalForPrismaApp.prismaApp ??
  new PrismaClient({ datasourceUrl: appDatasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrismaApp.prismaApp = prismaApp;
}

// ── withTenant — the ONLY correct way to run tenant-scoped queries ────────────
//
// Usage:
//   const orders = await withTenant(session.tenantId, session.userId, (tx) =>
//     tx.order.findMany({ where: { tenantId: session.tenantId, status: "ACTIVE" } })
//   );
//
// What it does:
//   1. Opens a Prisma transaction (single DB connection, single transaction block)
//   2. Calls set_tenant_context(tenantId, userId) — validates membership in DB
//   3. DB sets SET LOCAL app.current_tenant_id = tenantId (transaction-scoped)
//   4. RLS policy `prisma_app_tenant_all` allows only rows where
//      tenant_id = current_setting('app.current_tenant_id')
//   5. Your query fn runs — can ONLY see/write rows for tenantId
//   6. Transaction ends — session variable is cleared automatically

export async function withTenant<T>(
  tenantId: string,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaApp.$transaction(async (tx) => {
    // Validates membership AND sets app.current_tenant_id (transaction-local via SET LOCAL)
    await tx.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid, ${userId})`;
    return fn(tx);
  });
}
