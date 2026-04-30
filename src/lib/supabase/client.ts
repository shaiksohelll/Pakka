import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Singleton browser client ──────────────────────────────────────────────────
// A single instance is required so that `supabase.realtime.setAuth(token)`
// applies to ALL channels created anywhere in the app.  Creating a fresh
// client per component/call means Realtime uses the anon key for the channel
// established by a different instance, causing UPDATE payloads to be silently
// dropped by RLS before reaching the subscriber.
let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_client) return _client;

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // H2 fix: propagate the authenticated JWT to the Realtime transport so that
  // RLS SELECT policies evaluate against the user's session, not the anon key.
  _client.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      // setAuth is available on the Realtime instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_client as any).realtime.setAuth(session.access_token);
    }
  });

  return _client;
}
