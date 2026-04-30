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
  //
  // We branch on event type so that:
  //  - SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED  → push fresh token
  //  - SIGNED_OUT → clear the token AND remove all channels so that the old
  //    user's JWT does not linger on the websocket until tab close.  The next
  //    sign-in will recreate channels with the new session.
  _client.auth.onAuthStateChange((event, session) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = (_client as any).realtime;
    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      if (session?.access_token) {
        rt.setAuth(session.access_token);
      }
    } else if (event === "SIGNED_OUT") {
      // Pass empty string — the Supabase JS SDK accepts "" to revert to the
      // anon key, which is safer than null if the type does not accept null.
      rt.setAuth("");
      // Remove all open channels so a fresh sign-in starts clean.
      _client?.removeAllChannels();
    }
  });

  return _client;
}
