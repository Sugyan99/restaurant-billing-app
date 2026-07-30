import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(searchParams.get("error_description") ?? error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[auth/callback] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars");
    return NextResponse.redirect(`${origin}/login?error=server_misconfigured`);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    });

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.user) {
      console.error("[auth/callback] Exchange error:", exchangeError?.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError?.message ?? "auth_failed")}`
      );
    }

    // Upsert profile
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email ?? "",
        name:
          data.user.user_metadata?.full_name ??
          data.user.user_metadata?.name ??
          data.user.email?.split("@")[0] ??
          "User",
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return NextResponse.redirect(`${origin}/dashboard/home`);
  } catch (err) {
    console.error("[auth/callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?error=unexpected_error`);
  }
}
