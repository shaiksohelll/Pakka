# ADR-0037: Realtime Subscription Contract

**Status:** Proposed  
**Date:** 2026-05-02  
**Deciders:** Engineering

---

## Context

Supabase Realtime `postgres_changes` subscriptions were dropping events silently
across three surfaces. Three root causes (H2 / H3 / H4) were identified.

---

## H2 — Supabase client must be a singleton with `setAuth` wired at init

**Problem:** `createBrowserClient()` was called fresh inside every component, creating
a separate Realtime WebSocket per component. Each new client authenticated its
Realtime transport with the **anon key** only. The Realtime server evaluates RLS
`SELECT` policies with whatever JWT is in the Realtime handshake; the anon key
fails the policy, and the server silently drops all `UPDATE`/`INSERT` payloads.

**Fix:** `src/lib/supabase/client.ts` now exports a module-level singleton. At module
init, `getSession()` is called and the access token is forwarded to
`_client.realtime.setAuth()`. `onAuthStateChange` refreshes the token on every
session event (login, token refresh, logout).

```ts
const _client = createBrowserClient(url, anonKey);

_client.auth.getSession().then(({ data }) => {
  if (data.session?.access_token)
    _client.realtime.setAuth(data.session.access_token);
});

_client.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token)
    _client.realtime.setAuth(session.access_token);
});

export function createClient() { return _client; }
```

---

## H3 — `filter` must be a **string**, not an object literal

**Problem:** The object form `filter: { column: 'job_id', operator: 'eq', value: id }`
was used in some early drafts of subscriptions. This is **not valid** for
`postgres_changes`; only the string form is accepted.

**Fix / Contract:** All `postgres_changes` subscriptions must use the string form:

```ts
filter: `job_id=eq.${jobId}`   // ✅ correct
filter: { column: 'job_id', operator: 'eq', value: jobId }  // ❌ silently no-ops
```

All existing files were audited; no object-form filters were found in the Vite
migration. This ADR codifies the rule for future development.

---

## H4 — Channel cleanup and status logging are mandatory

**Contract:**

1. Every `.subscribe()` call must include a status callback:
   ```ts
   .subscribe((status) => console.log('[channel-name]', status))
   ```
   This surfaces `SUBSCRIBED`, `CHANNEL_ERROR`, and `TIMED_OUT` in DevTools so
   subscription problems are immediately visible rather than silent.

2. Cleanup must use `supabase.removeChannel(channel)`, not `channel.unsubscribe()`.
   `removeChannel` removes the channel from the internal registry; `unsubscribe`
   only closes the WebSocket message stream but leaks the channel object.

---

## Missing subscriptions added

| Component | Table | Event | Filter |
|---|---|---|---|
| `worker-feed.tsx` | `public.jobs` | INSERT | `status=eq.open` |
| `worker-applications.tsx` | `public.job_applications` | UPDATE | `worker_id=eq.${user.id}` |
| `client-job-detail.tsx` | `public.job_applications` | INSERT + UPDATE | `job_id=eq.${jobId}` |

`client-milestones.tsx` and `worker-milestones.tsx` already had correct INSERT/UPDATE
subscriptions; status callbacks were added.

---

## Migration

`202605020001_realtime_replica_identity_apps.sql` adds `REPLICA IDENTITY FULL` and
`supabase_realtime` publication membership for `job_applications`, `jobs`,
`notifications`, and `disputes` — tables that were missing from the earlier
`202604300002_realtime_replica_identity.sql` migration.
