import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("settings/GET", async () => {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  let settings = await prisma.settings.findFirst();

  // Auto-create default settings if none exist yet (fresh install)
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }

  return NextResponse.json({ settings });
});
}

export async function PUT(req: NextRequest) {
  return safeHandler("settings/PUT", async () => {
  const session = requireAuth(req, ["OWNER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();

  let settings = await prisma.settings.findFirst();

  if (!settings) {
    settings = await prisma.settings.create({ data: body });
  } else {
    settings = await prisma.settings.update({
      where: { id: settings.id },
      data: {
        restaurantName: body.restaurantName,
        address: body.address,
        gstNumber: body.gstNumber,
        cgstPercent: body.cgstPercent,
        sgstPercent: body.sgstPercent,
        phone: body.phone,
        email: body.email,
        website: body.website,
        currency: body.currency,
        openingCash: body.openingCash,
        receiptHeader: body.receiptHeader,
        receiptFooter: body.receiptFooter,
      },
    });
  }

  return NextResponse.json({ settings });
});
}
