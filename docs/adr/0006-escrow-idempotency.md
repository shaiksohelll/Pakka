# ADR 0006: End-to-End Idempotency Keys for Escrow RPCs

- **Status:** Accepted
- **Date:** 2026-06-03
- **Author:** Sohel
- **Supersedes:** —
- **Amends:** ADR 0002 (RLS + SECURITY DEFINER)
- **Related:** ADR 0004 (Migration Discipline), Phase 4.5

## Context

The four escrow state-machine RPCs — `fund_escrow`, `submit_milestone`, `approve_milestone`, and `dispute_milestone` — relied solely on status guards (`pending → funded`, `funded → submitted`, etc.) to prevent double-execution. While sufficient for sequential calls, concurrent requests (network retries, double-clicks escaping the in-flight gate) could race past the status check before the first transaction commits.

Client-side idempotency keys were already generated (`getOrCreateIdempotencyKey` in both milestone UIs), validated by Zod schemas, and passed to server actions — but server actions **discarded** them before the `.rpc()` call. The SQL functions did not accept an idempotency key parameter. This ADR closes that last-mile gap.

Additionally, two secondary issues were found during grounding:

1. **`'approved'` is a dead state.** The `milestone_status` enum includes `'approved'`, but no code ever sets a milestone to that status — `approve_milestone` transitions directly to `'released'`. The guard in `approve_milestone` accepted `'approved'` as a valid input state, which was misleading.
2. **Duplicate dispute rows.** `dispute_milestone` did not block re-disputing an already-disputed milestone, and no unique constraint prevented multiple `status = 'open'` dispute rows for the same milestone.

## Decision

In migration `supabase/migrations/20260603100000_escrow_idempotency.sql`:

### Indexes

Three new partial unique indexes:

| Index | Columns | WHERE | Purpose |
|---|---|---|---|
| `idx_escrow_ledger_fund_owner_reference` | `(to_wallet, reference_id)` | `type = 'fund'` | Per-wallet fund idempotency |
| `idx_escrow_ledger_release_owner_reference` | `(from_wallet, reference_id)` | `type = 'release'` | Per-wallet release idempotency |
| `idx_disputes_milestone_open` | `(milestone_id)` | `status = 'open'` | At most one open dispute per milestone |

### Function Signature Changes

Old signatures are DROPped (adding a param creates an overload, not a replacement). New signatures:

- `fund_escrow(p_milestone_id uuid, p_idempotency_key uuid)`
- `submit_milestone(p_milestone_id uuid, p_idempotency_key uuid)`
- `approve_milestone(p_milestone_id uuid, p_idempotency_key uuid)`
- `dispute_milestone(p_milestone_id uuid, p_reason text, p_idempotency_key uuid)`

### Idempotency Pattern Per Function

- **`fund_escrow` / `approve_milestone`:** After `FOR UPDATE` lock and auth check, SELECT from `escrow_ledger` by `reference_id = p_idempotency_key AND type = 'fund'/'release'`. If found → early RETURN (idempotent success). Otherwise run the existing guard, wallet mutation, and `INSERT INTO escrow_ledger` with `reference_id = p_idempotency_key`. No `EXCEPTION WHEN unique_violation` — the wallet is already mutated, so a constraint conflict rolls back the entire transaction atomically.
- **`submit_milestone`:** Accepts the key param for signature consistency but does not use it (no ledger row). Made idempotent by early-returning `p_milestone_id` if status is already `'submitted'`.
- **`dispute_milestone`:** SELECTs for an existing `status = 'open'` dispute on the milestone. If found → early RETURN. Otherwise proceeds, with the `INSERT INTO disputes` wrapped in `BEGIN … EXCEPTION WHEN unique_violation` to handle races (safe because no money moves before the insert).

### Approve Guard Fix

Removed dead `'approved'` from the allow-list: `not in ('funded', 'submitted', 'approved')` → `not in ('funded', 'submitted')`.

### Server Action Changes

All four actions in `src/app/_actions/escrow.ts` now destructure `idempotency_key` from the Zod-parsed data and pass it as `p_idempotency_key` in the `.rpc()` call.

### Client Fix

`worker-milestones.tsx` helper updated from `getOrCreateIdempotencyKey(milestoneId)` to `getOrCreateIdempotencyKey("submit", milestoneId)`, matching the `client-milestones.tsx` convention of keying by `(action, milestoneId)`.

## Rationale

- **Mirrors proven topup/withdraw pattern.** The per-wallet partial unique indexes follow the exact same design established in migrations `20260518002100` and `20260518135600`.
- **Check-first, not catch-first for wallet-mutating RPCs.** `fund_escrow` and `approve_milestone` mutate wallet balances before the ledger INSERT. A `unique_violation` catch would leave wallet balances inconsistent. The check-first pattern returns early if the key is already committed.
- **Catch-first is safe for dispute_milestone.** No money moves before the `INSERT INTO disputes`, so a `unique_violation` rollback of just the inner block is safe.
- **DROPping old signatures is safe.** No other DB function calls these 4 RPCs. Admin/cron functions (`admin_force_release`, `admin_refund`, `auto_release_milestones`) mutate status and wallets directly.

## Consequences

- Network retries and double-clicks are now safe for all 4 escrow operations. The first call wins; replays return the same result.
- `reference_id` in `escrow_ledger` now carries the client-generated idempotency UUID for fund/release rows (previously it was `p_milestone_id`). Existing topup/withdraw rows are unaffected (scoped by partial indexes).
- At most one open dispute can exist per milestone. Historical data with duplicate disputes (if any) is unaffected — the partial index only constrains `status = 'open'`.
- The dead `'approved'` enum value remains in `milestone_status` (removing an enum value requires `DROP TYPE` and recreation, which is disruptive). It is simply no longer referenced in any guard.

## Alternatives Considered

- **Global unique index on `reference_id`.** Rejected: cross-type collisions between topup and fund keys, even if statistically impossible with v4 UUIDs, violate the per-type scoping principle.
- **Wrap all escrow RPCs in a generic idempotency middleware.** Rejected: each function has different idempotency semantics (ledger-based, status-based, dispute-based).
- **Remove `'approved'` from the enum.** Rejected: requires `DROP TYPE … CREATE TYPE` cascade, too disruptive for a dead-code cleanup.
