# ADR 0005: Permitting In-Place Modification of auto_release_milestones in PR #19

- **Status:** Accepted
- **Date:** 2026-05-21
- **Author:** Sohel
- **Supersedes:** —
- **Amends:** ADR 0004 (Migration Discipline)
- **Related:** PR #19, ADR 0002 (RLS + SECURITY DEFINER)

## Context

PR #19 review surfaced two defects in `public.auto_release_milestones()`, the cron-invoked SECURITY DEFINER function that releases milestones whose 72-hour auto-release window has elapsed:

1. **Copilot review #1** (`#discussion_r3261123627`): The function uses `perform set_config('pakka.allow_milestone_status_change', 'on', true)` as the bypass mechanism that lets it satisfy `guard_milestones_status` and `guard_jobs_status`. The GUC pattern is fragile — any database role with `SET` privilege can flip the same GUC and bypass the guards from a non-cron context.
2. **CodeRabbit review #3** (`#discussion_r3261116639`): When the function skips a milestone because the client's wallet has insufficient `locked_balance` to cover the milestone amount, it does so silently with no log entry. Stuck milestones become invisible in operations.

ADR 0004 requires an explicit ADR before modifying any SECURITY DEFINER financial state-machine function in place. This ADR provides that approval for the two modifications above.

## Decision

In migration `supabase/migrations/20260521080000_pr19_review_fixes.sql`, modify `public.auto_release_milestones()` to:

1. **Remove** the `perform set_config('pakka.allow_milestone_status_change', 'on', true)` call.
2. **Replace** the GUC-based bypass with a direct cron-context check in the guard functions: `not (session_user = 'postgres' and current_user = 'postgres')`. Both `guard_milestones_status` and `guard_jobs_status` are updated atomically in the same migration.
3. **Add** `raise notice 'auto_release_milestones: skipping milestone % (job %): insufficient locked balance for amount %', m.id, m.job_id, m.amount;` in the insufficient-locked-balance branch.

A wrapper RPC is not appropriate: the defects are inside the function body (the GUC call and the silent skip branch). A wrapper cannot remove either.

## Rationale

- **Behavioral surface unchanged.** Signature remains `() -> integer`. Invocation pattern remains `pg_cron` at `30 20 * * *` UTC (02:00 IST daily, `jobid = 2`, verified live). Output semantics — count of released milestones — is preserved.
- **Bypass mechanism strictly stronger.** `session_user = 'postgres'` is set by the Postgres connection role used by `pg_cron`'s background worker and cannot be spoofed from a PostgREST / Supabase client connection, which authenticates as `authenticated` or `anon`. The prior GUC could be flipped by any role with `SET` privilege.
- **Observability improvement is purely additive.** A `RAISE NOTICE` writes to Postgres logs without changing function output or transaction behavior.
- **Atomic update of guard functions.** Updating `auto_release_milestones` without simultaneously updating the two guard functions would break the cron job. The three functions must move together; bundling them in one migration is correct.

## Consequences

- Bypass surface narrows from "any role with SET privilege" to "the literal `postgres` connection role used by pg_cron." Closes a theoretical privilege-escalation path.
- Skipped milestones are visible in `postgres-logs` going forward. Operations can grep for `auto_release_milestones: skipping`.
- Original function body remains preserved in migration `20260518225500_schedule_auto_release_cron.sql` (append-only history; nothing rewritten in place at the file level).
- Future modifications to `auto_release_milestones` still require a new ADR per ADR 0004.

## Alternatives Considered

- **Wrapper RPC (`rpc_auto_release_milestones`).** Rejected: the defects are inside the body. A wrapper would still call the broken inner function.
- **Leave the GUC in place and only fix the silent skip.** Rejected: Copilot's concern about GUC settability is valid and a future security hardening pass would have to revisit it anyway.
- **Defer to PR #20 or later.** Rejected: the two defects are co-located with code already being modified in PR #19's review-fix cycle; deferring duplicates the migration churn.