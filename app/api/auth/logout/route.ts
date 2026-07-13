import { safeHandler } from "@/lib/apiHandler";
import { NextResponse } from "next/server";

export async function POST() {
  return safeHandler("auth/logout/POST", async () => {
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", "", { maxAge: 0, path: "/" });
  return response;
});
}
