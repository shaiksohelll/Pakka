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

    await supabase.realtime.setAuth(null)
    await supabase.auth.signOut()

`realtime.setAuth(null)` immediately propagates a null JWT to all open channels, which causes the server to stop sending messages scoped to that user. Without this, channels continue to push for up to a full reconnection interval.

Components that call `signOut()` must call it through a single helper (currently inlined in the sign-out button and delete-account dialog) that follows this order. Direct calls to `supabase.auth.signOut()` without the realtime cleanup are forbidden.

### Rule 4 — Browser client is a factory, not a singleton

`src/lib/supabase/client.ts` exports `createClient()` as a factory function, not a module-level singleton. Every consumer calls `createClient()` to get a fresh client instance.

Rationale:

- A singleton captured at module load can retain stale auth state across logical sessions, especially in dev with fast refresh.
- A singleton makes it impossible to construct a client with route-specific or per-request configuration if we ever need it.
- The cost of a fresh client is negligible — it's a thin wrapper over a single global underlying fetch transport.

Consumers must always import the factory and call it locally:

    import { createClient } from "@/lib/supabase/client"

    export function MyComponent() {
      const supabase = createClient()
      // ...
    }

Never:

    import { supabase } from "@/lib/supabase/client" // forbidden — no singleton export

## Critical surfaces covered

- `src/hooks/use-user.ts` — the sole `onAuthStateChange` subscription
- `src/lib/supabase/client.ts` — browser client factory + sign-out helper
- `src/lib/supabase/server.ts` — server client for SSR / Route Handlers (separate concern, not covered here beyond noting it exists)
- Every component that needs the current user — reads `useUser()` only
- Every component that signs out — calls the sign-out helper, not raw `auth.signOut()`

## Consequences

### Positive

- **No auth-event thrash.** Token refreshes are silent. Network traffic and re-renders only happen when identity actually changes.
- **No stale realtime messages after sign-out.** Channels stop receiving immediately.
- **Single auditable subscription.** Anyone debugging auth behavior has one file to read (`use-user.ts`).
- **Composable.** New components that need the user just call `useUser()` — no auth plumbing.

### Negative (and accepted)

- **Discipline required.** Two patterns (singleton client, direct `onAuthStateChange`) are normal in Supabase examples and tutorials. Reviewers must reject these on sight.
- **Slightly more code than the naive approach.** The `useUser()` hook is ~80 lines for what could be 5 lines of bad code.

## Rejected alternatives

### Multiple `onAuthStateChange` subscribers

Each subscriber owns its own slice of cache invalidation. Rejected: identical event triggers N reactions in unspecified order; coordinating them is harder than just having one coordinator.

### Invalidate on every auth event

Simpler handler (one line), but causes the G9 thrash. Rejected: the bug is real and user-visible.

### Module-level singleton browser client

Common in Supabase tutorials. Rejected: fast-refresh staleness, no per-request config, and the perf cost of factory is negligible.

### Server-only auth check (no client hook)

Rely entirely on `getUser()` in Server Components. Rejected: the app has client-side interactivity (dialogs, dropdowns, form state) that needs to know "is the user still signed in" without a server round-trip; without a client-side cache this becomes either polling or stale.

## Verification

When reviewing a PR that touches auth or Supabase client construction, confirm:

1. **No new `onAuthStateChange` calls** outside `src/hooks/use-user.ts`. Grep: `onAuthStateChange`.
2. **No new singleton-style imports.** Grep: `import { supabase }` (should only match if `supabase` is a local variable name — verify by reading).
3. **Every `signOut` call site** is wrapped by the helper that does `realtime.setAuth(null)` first. Grep: `auth.signOut`.
4. **Every consumer of current-user state** calls `useUser()` and does not call `getUser()` directly. Grep: `getUser`.

A future Phase 5 task is to encode these as ESLint rules (custom rule set under `eslint-plugin-pakka`); for now, code review is the gate.

## References

- `src/hooks/use-user.ts` — `useUser()` hook with single `onAuthStateChange` subscription
- `src/lib/supabase/client.ts` — browser client factory + `realtime.setAuth(null)` on sign-out
- `src/lib/supabase/server.ts` — server-side client (separate file, not covered here)
- `src/components/account/sign-out-button.tsx` — example call site of the sign-out helper
- `src/components/account/delete-account-dialog.tsx` — example call site post-deletion
- ADR 0002 — RLS + SECURITY DEFINER as the only escrow path
