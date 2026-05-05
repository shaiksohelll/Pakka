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

  // Fix A: Eagerly prime the Realtime transport with the persisted session JWT
  // so that channels created in useEffect callbacks (macrotasks) don't start
  // life with the anon key. @supabase/ssr resolves getSession() from the
  // cookie cache — no network round-trip — so the .then() is a microtask
  // that completes before the browser's first useEffect macrotask fires.
  _client.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_client as any).realtime.setAuth(session.access_token);
    }
  });

  // Propagate the authenticated JWT to the Realtime transport so that
  // RLS SELECT policies evaluate against the user's session, not the anon key.
  //
  // Only act when a session is present (INITIAL_SESSION, SIGNED_IN,
  // TOKEN_REFRESHED, USER_UPDATED). Do NOT handle SIGNED_OUT here —
  // @supabase/ssr fires spurious SIGNED_OUT events during cookie-based token
  // refresh races, and calling removeAllChannels() on those causes the channel
  // oscillation visible in the console.
  _client.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_client as any).realtime.setAuth(session.access_token);
    }
  });

  return _client;
}
