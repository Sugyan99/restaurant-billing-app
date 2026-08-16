import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

// Prisma error codes that mean the DB is temporarily unreachable
// (Supabase free tier waking up, transient network blip, etc.)
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 600; // first retry after 600ms, then 1200ms, then 1800ms

function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return RETRYABLE_CODES.has(err.errorCode ?? "");
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_CODES.has(err.code);
  }
  // Network-level errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT)
  if (err instanceof Error) {
    return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up/i.test(err.message);
  }
  return false;
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

export async function safeHandler(
  context: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (isRetryable(err) && attempt < MAX_RETRIES) {
        // DB is waking up (Supabase cold start). Wait and retry silently.
        logger.error(`${context} [retry ${attempt}/${MAX_RETRIES - 1}]`, err);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      logger.error(context, err);
      const msg = err instanceof Error ? err.message : "Internal server error";
      const clientMsg =
        process.env.NODE_ENV === "production" ? "Something went wrong" : msg;
      return NextResponse.json({ error: clientMsg }, { status: 500 });
    }
  }

  // Should never reach here — satisfies TypeScript
  return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
}
