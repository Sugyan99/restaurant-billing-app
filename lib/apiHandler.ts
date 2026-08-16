import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

// P1001 = Can't reach DB   P1002 = Timeout   P1008 = Query timeout   P1017 = Server closed connection
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError)
    return RETRYABLE_CODES.has(err.errorCode ?? "");
  if (err instanceof Prisma.PrismaClientKnownRequestError)
    return RETRYABLE_CODES.has(err.code);
  if (err instanceof Error)
    return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|Can't reach database/i.test(err.message);
  return false;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Retry schedule (ms): 1s → 3s → 5s → 7s  = up to ~16s total
// Covers Supabase free-tier DB wakeup time (typically 5–15s)
const RETRY_DELAYS = [1000, 3000, 5000, 7000];

export async function safeHandler(
  context: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (isRetryable(err) && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        logger.error(`${context} [DB unreachable, retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms]`, err);
        await sleep(delay);
        continue;
      }
      logger.error(context, err);
      const msg = err instanceof Error ? err.message : "Internal server error";
      const clientMsg = process.env.NODE_ENV === "production" ? "Something went wrong" : msg;
      return NextResponse.json({ error: clientMsg }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
}
