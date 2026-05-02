import { createBrowserClient } from "@supabase/ssr";

// Singleton — one client, one Realtime WebSocket for the page lifetime.
// Multiple createBrowserClient() calls create separate connections; channels on
// different instances never share an authenticated JWT.
const _client = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
);

// H2 (ADR-0037): wire the authenticated session JWT into the Realtime transport
// at module init — not inside a hook. Without this, every channel subscribes
// with the anon key, the Realtime server evaluates SELECT RLS against the wrong
// JWT, and silently drops UPDATE/INSERT payloads before they reach the client.
_client.auth.getSession().then(({ data }) => {
  if (data.session?.access_token) {
    _client.realtime.setAuth(data.session.access_token);
  }
});

_client.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    _client.realtime.setAuth(session.access_token);
  }
});

export function createClient() {
  return _client;
}
