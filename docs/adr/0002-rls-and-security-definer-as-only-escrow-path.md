# ADR 0002 — RLS + SECURITY DEFINER as the only escrow path

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Sohel (founder)
- **Supersedes:** —
- **Related:** ADR 0001 (escrow state machine in Postgres), `docs/state-machine.md`, `docs/data-model.md`

## Context

Pakka holds money in escrow between clients (homeowners hiring help) and workers (gold workers, etc.). Critical operations must be:

1. **Atomic** — a milestone completion touches `milestones`, `escrow_balances`, `payments`, and `notifications` in one logical step.
2. **Auditable** — every state transition leaves a row that says who, when, why.
3. **Rule-bound** — only certain transitions are valid (e.g. you can't release funds on a milestone that's still `in_progress`).
4. **Unbypassable** — a malicious or buggy client must not be able to skip a step or fabricate a transition.

Two designs were considered:

- **(A) Client SDK direct table writes, RLS predicates enforce rules.** Clients call `supabase.from("jobs").update(...)` and RLS gates it.
- **(B) Client calls SECURITY DEFINER RPCs; bare-table writes RLS-blocked.** Clients call `supabase.rpc("accept_milestone", {...})`; the RPC body owns all logic.

## Decision

**We adopt (B) for every critical table.** Specifically:

- All money-moving and state-transitioning operations are implemented as `SECURITY DEFINER` PL/pgSQL functions in the `public` schema.
- The `authenticated` role receives `EXECUTE` on these functions explicitly. No other role does.
- `anon` receives no grants on any business RPC (explicit `REVOKE EXECUTE … FROM anon` on every function; PostgREST schema exposure implicitly grants to `anon` otherwise — see `20260516131000_secure_request_account_deletion_revoke_anon.sql`).
- Bare-table `INSERT` / `UPDATE` / `DELETE` on critical tables is **not** granted to `authenticated` via any PERMISSIVE policy. The RPC is the only path.
- Authorization checks inside RPCs use the helper `public.is_job_participant(job_id)` (or equivalent) — never role-only checks (`role = 'client'` alone is insufficient because role is set during onboarding and would let any client edit any job).
- Mutations to `jobs.status` are additionally guarded by the `guard_jobs_status` trigger (`WHEN (OLD.status IS DISTINCT FROM NEW.status)`).
- Every `SECURITY DEFINER` function declares `SET search_path = public` to prevent search-path hijacking.

## Critical tables covered

- `jobs` — state machine transitions only via RPC
- `milestones` — state machine transitions only via RPC
- `escrow_balances` — RPC-only writes
- `payments` — RPC-only writes
- `job_applications` — accept/reject via RPC only
- `disputes` — open/resolve via RPC
- `notifications` — inserts originate from inside business RPCs; client cannot insert directly
- `profiles` — `deletion_requested_at` / `deletion_reason` write via `request_account_deletion` RPC only

## RPCs following this pattern (non-exhaustive)

- `accept_milestone(...)`
- `release_funds(...)`
- `request_account_deletion(reason)`
- `open_dispute(...)`
- `resolve_dispute(...)`
- `apply_to_job(...)`
- `accept_application(...)`
- `cancel_job(...)`


## Consequences

### Positive

- **Atomicity.** Multi-table state transitions happen in a single transaction inside the RPC; clients can't observe an intermediate state and can't half-apply a transition.
- **Single source of truth for business rules.** All "is this transition legal?" logic lives in PL/pgSQL, not in N client codepaths.
- **Defense in depth.** Even if a future RLS policy is misconfigured, the lack of table-write grants prevents abuse.
- **Auditability.** RPCs can log their inputs and the requesting `auth.uid()` uniformly.

### Negative (and accepted)

- **Supabase performance advisor flags 13× "authenticated can execute SECURITY DEFINER functions."** This is the advisor flagging this exact ADR being implemented. Accepted permanently; suppress in future advisor triage.
- **More PL/pgSQL to maintain** than a pure client-SDK approach. Mitigated by keeping each RPC small and pairing it with a forward migration + rollback file (see `supabase/sql/rollbacks/README.md`).
- **Harder local testing.** Need DB-level fixtures rather than mocking a client. Mitigated by deterministic test data + a seeded test schema (Phase 5 work).
- **Cannot bulk-update from the client.** A future admin tool that needs bulk operations must implement a dedicated bulk RPC, not loop `update()` calls.

## Rejected alternatives

### Pure RLS without RPCs

Cannot enforce multi-row atomicity. An escrow transfer touches 3+ tables; doing it via separate client-issued `update()` calls means any intermediate failure leaves the system inconsistent.

### Server-side route handlers / Edge Functions for writes

Adds a round-trip without solving the bypass problem: if `authenticated` retains direct `UPDATE` grants on the table, a determined client can still bypass the route handler by calling Supabase directly. The grant-revocation requirement is the same — at which point the SECURITY DEFINER RPC is strictly simpler.

### Trigger-only enforcement

Triggers can enforce single-table invariants but cannot atomically write to multiple tables on behalf of the caller in a way that's both transactional and authorization-aware. Used as a complement (see `guard_jobs_status`), not a replacement.

## Implementation rules (mandatory for new RPCs)

When adding a new RPC under this ADR:

1. Function is `SECURITY DEFINER`, `LANGUAGE plpgsql`, with `SET search_path = public`.
2. First statement: `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;`
3. Authorization check uses `is_job_participant(...)` or equivalent ownership predicate, not bare role checks.
4. State transitions verify the source state (e.g. `WHERE status = 'in_progress'` in the UPDATE) and check `FOUND` or use `RETURNING` to detect no-op writes.
5. Mutations are idempotent under retry. If a duplicate call is meaningless (e.g. "request deletion"), use atomic guards (`UPDATE … WHERE deletion_requested_at IS NULL RETURNING id`).
6. After definition: `REVOKE ALL ON FUNCTION public.<fn>(...) FROM PUBLIC; REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM anon; GRANT EXECUTE ON FUNCTION public.<fn>(...) TO authenticated;`
7. Forward migration accompanied by a rollback file in `supabase/sql/rollbacks/` (see `supabase/sql/rollbacks/README.md` for naming and emergency-execution procedure).

## Verification

- Supabase advisor (security): 13× "authenticated can execute SECURITY DEFINER" — accepted, this ADR is the canonical exception.
- Supabase advisor (security): 0× "anon can execute …" expected. Verified after `20260516131000_secure_request_account_deletion_revoke_anon.sql`.
- Supabase advisor (performance): 0× `auth_rls_initplan` — verified post PR #1 perf migrations.

## References

- ADR 0001 — Escrow state machine in Postgres
- `supabase/migrations/20260514111300_security_hardening.sql` — initial anon EXECUTE revokes + RLS policy retargets
- `supabase/migrations/20260514113000_security_hardening_followup.sql` — security hardening follow-up
- `supabase/migrations/20260514164000_prevent_self_application.sql` — example of business rule in RPC
- `supabase/migrations/20260516125000_request_account_deletion_atomic.sql` — atomic idempotency pattern
- `supabase/migrations/20260516131000_secure_request_account_deletion_revoke_anon.sql` — defense-in-depth anon revoke pattern
- `supabase/sql/rollbacks/README.md` — rollback file naming and emergency-execution procedure