import { PrismaClient } from "@prisma/client";

// In dev mode, Next.js hot-reloads files which can create many Prisma Client
// instances and exhaust DB connections. This pattern reuses a single instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
