import { safeHandler } from "@/lib/apiHandler";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  return safeHandler("auth/logout/POST", async () => {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Sign out from Supabase (clears Supabase session cookies)
    await supabase.auth.signOut();

    // Clear JWT cookie (email/password auth)
    const response = NextResponse.json({ success: true });
    response.cookies.set("token", "", { maxAge: 0, path: "/" });
    return response;
  });
}
