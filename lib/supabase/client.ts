import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",        // No PKCE verifier needed — tokens in URL hash
        detectSessionInUrl: true,    // Auto-parses hash on callback page
      },
    }
  );
}
