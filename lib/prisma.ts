import { PrismaClient, Prisma } from "@prisma/client";

// Admin client: use only for auth/admin operations. Tenant-scoped data must use prismaApp + withTenant().
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const datasourceUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const BUILD_SAFE_URL = "postgresql://build:build@127.0.0.1:1/build";

if (!datasourceUrl) console.warn("No privileged database URL configured; database access will fail at runtime until DATABASE_URL or POSTGRES_PRISMA_URL is configured.");

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl ?? BUILD_SAFE_URL });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// App client: non-superuser connection intended for RLS-protected tenant queries.
const globalForPrismaApp = globalThis as unknown as { prismaApp: PrismaClient | undefined };
const appDatasourceUrl = process.env.APP_DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

export const prismaApp = globalForPrismaApp.prismaApp ?? new PrismaClient({ datasourceUrl: appDatasourceUrl ?? BUILD_SAFE_URL });
if (process.env.NODE_ENV !== "production") globalForPrismaApp.prismaApp = prismaApp;

export async function withTenant<T>(tenantId: string, userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prismaApp.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid, ${userId})`;
    return fn(tx);
  });
}
