import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Singleton browser client ──────────────────────────────────────────────────
// A single instance is required so that auth token changes propagate to ALL
// Realtime channels.  The `accessToken` getter ensures the Realtime WebSocket
// always attaches the user's JWT (not the anon key) before connecting, which
// fixes the silent event-drop bug for RLS-protected tables (milestones,
// escrow_ledger, wallets).
let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // Eagerly prime the Realtime transport with the persisted session JWT so that
  // channels created in useEffect callbacks don't start with the anon key.
  // @supabase/ssr resolves getSession() from the cookie cache — no network
  // round-trip — so the .then() microtask completes before the browser's first
  // useEffect macrotask fires.
  _client.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_client as any).realtime.setAuth(session.access_token);
      console.log("[supabase-client] eager-prime: JWT applied");
    } else {
      console.log("[supabase-client] eager-prime: no session");
    }
  });

  // Propagate JWT changes (sign-in, token refresh, sign-out) to Realtime.
  // The internal _listenForAuthEvents should handle this, but @supabase/ssr
  // cookie-based flows sometimes race — this explicit listener guarantees
  // the Realtime transport stays in sync with the auth state.
  _client.auth.onAuthStateChange((event, session) => {
    console.log("[supabase-client] auth-event", event,
      session ? "session-present" : "no-session");
    if (session?.access_token) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_client as any).realtime.setAuth(session.access_token);
    }
  });

  return _client;
}
