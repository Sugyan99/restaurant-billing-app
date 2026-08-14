import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("settings/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    let settings = await prisma.settings.findFirst({ where: { tenantId: session.tenantId } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { tenantId: session.tenantId } });
    }
    // Never expose raw API key to client — mask it
    const masked = settings.groqApiKey
      ? "gsk_" + "*".repeat(20) + settings.groqApiKey.slice(-4)
      : "";
    return NextResponse.json({ settings: { ...settings, groqApiKey: masked } });
  });
}

export async function PUT(req: NextRequest) {
  return safeHandler("settings/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;

    const body = await req.json();

    let settings = await prisma.settings.findFirst({ where: { tenantId: session.tenantId } });

    // Only update groqApiKey if a real new key is provided (not the masked placeholder)
    const newKey = body.groqApiKey && !body.groqApiKey.includes("****")
      ? body.groqApiKey.trim()
      : undefined;

    const data: Record<string, unknown> = {
      restaurantName: body.restaurantName,
      address:        body.address,
      gstNumber:      body.gstNumber,
      cgstPercent:    body.cgstPercent,
      sgstPercent:    body.sgstPercent,
      phone:          body.phone,
      email:          body.email,
      website:        body.website,
      currency:       body.currency,
      openingCash:    body.openingCash,
      taxMode:        body.taxMode,
      isIGST:         body.isIGST,
      igstPercent:    body.igstPercent,
      receiptHeader:  body.receiptHeader,
      receiptFooter:  body.receiptFooter,
      groqModel:      body.groqModel ?? "llama3-8b-8192",
      aiEnabled:      body.aiEnabled ?? true,
    };
    if (newKey) data.groqApiKey = newKey;

    if (!settings) {
      settings = await prisma.settings.create({ data: { tenantId: session.tenantId, ...data } as Parameters<typeof prisma.settings.create>[0]["data"] });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: data as Parameters<typeof prisma.settings.update>[0]["data"],
      });
    }

    const masked = settings.groqApiKey
      ? "gsk_" + "*".repeat(20) + settings.groqApiKey.slice(-4)
      : "";
    return NextResponse.json({ settings: { ...settings, groqApiKey: masked } });
  });
}
