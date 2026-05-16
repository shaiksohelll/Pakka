# ADR 0003 — Auth state hygiene on the browser client

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Sohel (founder)
- **Supersedes:** —
- **Related:** ADR 0002 (RLS + SECURITY DEFINER as only escrow path)

## Context

Pakka uses Supabase Auth in a Next.js App Router app. The browser surface combines three things that interact awkwardly:

1. **Supabase Auth's `onAuthStateChange` event stream** — fires on `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, and `PASSWORD_RECOVERY`.
2. **TanStack Query** as the cache for the current-user identity (`["current-user"]`) and downstream data scoped to that user (jobs, profiles, etc.).
3. **Supabase Realtime channels** that authenticate using the user's JWT at subscribe time and keep using it across the channel lifetime.

Two failure modes are easy to hit if these are not coordinated:

- **G9 — Auth-event thrash.** A naive `onAuthStateChange` handler that calls `queryClient.invalidateQueries({ queryKey: ["current-user"] })` on every event will refetch the user on every token refresh (default ~60 min) and re-render every component that reads from that key. The visible symptom is a brief loading flash and unnecessary network traffic; the invisible symptom is downstream effects firing repeatedly.

- **G13 — Stale realtime auth on sign-out.** Realtime channels capture the JWT they were subscribed with. Calling `supabase.auth.signOut()` invalidates the JWT on the auth server but does **not** notify open realtime channels. The channels continue to push messages until they next reconnect (or until the server tears them down), which leaks data scoped to the now-signed-out user.

These were both hit and fixed during PR #4. This ADR locks the fix in.

## Decision

We establish four mandatory rules for any browser-side code that touches auth state.

### Rule 1 — Single auth-state coordinator (the `useUser()` hook)

There is exactly **one** `onAuthStateChange` subscription in the browser app, owned by `src/hooks/use-user.ts`. All other components read the current user via the `useUser()` hook, which is backed by a TanStack Query keyed on `["current-user"]`.

Other components must **never** subscribe to `onAuthStateChange` directly. They must **never** call `supabase.auth.getUser()` outside of the hook's query function.

### Rule 2 — Event-specific cache updates (the G9 fix)

Inside the single `onAuthStateChange` handler, branch on the event type:

- `SIGNED_IN` → `queryClient.invalidateQueries({ queryKey: ["current-user"] })` to refetch the new identity, and invalidate any other user-scoped query keys (e.g. `["profile"]`, `["jobs"]`).
- `SIGNED_OUT` → `queryClient.setQueryData(["current-user"], null)` directly (do not refetch — the server will reject the request anyway), then `queryClient.clear()` to drop downstream cached data for the previous user.
- `USER_UPDATED` → `queryClient.invalidateQueries({ queryKey: ["current-user"] })`.
- `TOKEN_REFRESHED` → **no-op.** The session is the same identity; do not invalidate.
- `INITIAL_SESSION` → no-op if the query already has data; otherwise let the initial fetch populate it.
- `PASSWORD_RECOVERY` → no-op for the cache; route to the recovery flow if needed.

### Rule 3 — Realtime auth cleanup on sign-out (the G13 fix)

Sign-out must invalidate the realtime auth token **before** calling `supabase.auth.signOut()`:
