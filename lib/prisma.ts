import { PrismaClient, Prisma } from "@prisma/client";

// Admin client: privileged connection used only for authentication and
// administrative operations. Never use it for tenant-scoped application data.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!datasourceUrl) {
  throw new Error(
    "FATAL: No privileged database URL configured. Set DATABASE_URL or POSTGRES_PRISMA_URL."
  );
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// App client: MUST use the dedicated non-superuser role in production so
// PostgreSQL RLS is enforced. Never silently fall back to an admin URL.
const globalForPrismaApp = globalThis as unknown as {
  prismaApp: PrismaClient | undefined;
};

const appDatasourceUrl = process.env.APP_DATABASE_URL;

if (!appDatasourceUrl) {
  throw new Error(
    "FATAL: APP_DATABASE_URL is required. It must point to the non-superuser prisma_app role."
  );
}

export const prismaApp =
  globalForPrismaApp.prismaApp ??
  new PrismaClient({ datasourceUrl: appDatasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrismaApp.prismaApp = prismaApp;
}

// The only supported path for tenant-scoped application queries.
export async function withTenant<T>(
  tenantId: string,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaApp.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid, ${userId})`;
    return fn(tx);
  });
}
