import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function safeHandler(
  context: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err: unknown) {
    logger.error(context, err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    // Never expose Prisma internals to client in production
    const clientMsg =
      process.env.NODE_ENV === "production" ? "Something went wrong" : msg;
    return NextResponse.json({ error: clientMsg }, { status: 500 });
  }
}
