# ADR-0034: Worker Summary RPC for Client Job Detail

**Status:** Accepted  
**Date:** 2026-05-02  
**Deciders:** Engineering

---

## Context

`client-job-detail.tsx` enriched each application row with the worker's display name
and trust tier by issuing two plain queries:

```ts
supabase.from('profiles').in('id', workerIds)
supabase.from('worker_profiles').in('profile_id', workerIds)
```

Supabase RLS on `profiles` is self-read-only: `auth.uid() = id`. A client session
therefore receives an **empty array — not an error** — for every `profiles` lookup
that targets another user's row. The UI silently fell back to `"Worker"` / `"Bronze"`,
hiding real names and tier info from clients reviewing applications.

---

## Decision

Replace both plain queries with a single `SECURITY DEFINER` RPC:

```ts
supabase.rpc('get_application_worker_summary', { worker_ids: workerIds })
```

The function (`202605020002_application_worker_summary.sql`) runs under the
`postgres` role, bypassing RLS, but applies its own business-level scope guard:

> Only return workers where `auth.uid()` has an active (non-rejected)
> `job_applications` row for a job owned by the calling client.

This prevents any cross-client data leak while allowing legitimate lookups.

---

## Consequences

- **Good:** worker names and trust tiers render correctly in the applications list.
- **Good:** `StatusBadge` now accepts `null | undefined` variant and renders `—`
  explicitly (no silent Bronze default).
- **Good:** single RPC round-trip replaces two fan-out queries.
- **Neutral:** the RPC must be kept in sync if the `profiles` / `worker_profiles`
  schema changes.
- **Risk mitigated:** SECURITY DEFINER scope guard checked against `job_applications`
  + `jobs.client_id = auth.uid()` before returning any row.
