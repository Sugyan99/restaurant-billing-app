import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by Vercel Cron (vercel.json) every 5 minutes to prevent
// Supabase free-tier project from pausing due to inactivity.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

// Allow unauthenticated access — this endpoint has no sensitive data
export const dynamic = "force-dynamic";
