# ADR 0004 — Migration discipline

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Sohel (founder)
- **Supersedes:** —
- **Related:** ADR 0001 (escrow state machine), ADR 0002 (RLS + SECURITY DEFINER), ADR 0003 (auth state hygiene)

## Context

Pakka runs on the Supabase free plan, which does not support database branching or preview environments. Every schema change is applied directly to the single production database. The database holds real user records, escrow balances, and job state, so a bad migration cannot be casually rolled back by spinning up a fresh branch.

This forces a stricter migration discipline than a team with full branching would need. Three things must always be true:

1. The history of schema changes in git matches the history of `supabase_migrations.schema_migrations` in prod, exactly.
2. Every applied change has a written escape hatch (a rollback SQL file) that can be executed by hand if something breaks.
3. After every applied change, the Supabase advisor (performance + security) is checked so regressions surface in minutes, not weeks.

PRs #1 through #8 evolved this discipline informally. This ADR locks it in.

## Decision

Six mandatory rules govern every database change.

### Rule 1 — Forward-only migrations

Migrations are append-only. To reverse a change in normal operation, write a **new** forward migration that performs the inverse. Never edit, rename, or delete an existing migration file after it has been applied to any environment.

This means a "fix" to a recently-applied migration is itself a new migration, with its own timestamp and its own rollback file.

### Rule 2 — Every forward migration has a rollback companion

For every `supabase/migrations/<timestamp>_<name>.sql`, there must be a paired `supabase/sql/rollbacks/<timestamp+100s>_<name>_rollback.sql`.

The "+100 seconds" offset is chosen so the rollback sorts immediately after its forward when listed lexicographically, without colliding with any other migration timestamp.

The rollback file is an emergency safety net. It is **not** automatically applied. It exists so that if a forward migration causes a prod incident, a human can paste it into the Supabase SQL editor and execute it within seconds.

### Rule 3 — Rollback files start with a header comment

Every rollback file begins with:

    -- Reverses: supabase/migrations/<timestamp>_<name>.sql
    -- Authored: <YYYY-MM-DD>
    -- Prerequisites: <e.g. "no downstream code depends on the dropped column">
    -- Safe to run while users are online: <yes | no | with caveat>

This header is the first thing a human reads under pressure. It must answer "what does this undo" and "will running this break anything else" in five seconds.

### Rule 4 — Rollback inventory

`supabase/sql/rollbacks/README.md` contains a sorted table listing every forward + rollback pair with a one-line summary. New pairs are added in the **same commit** as the migration, never in a follow-up.

The inventory is the single source of truth for "what rollbacks exist and what they do." If it falls out of sync, future-Sohel reaches for a rollback that does not match what is on disk.

### Rule 5 — Apply via Supabase MCP `apply_migration`

The free plan blocks `supabase db push --linked` workflows that depend on branching. The canonical apply path is the Supabase MCP `apply_migration` tool. The author pastes the forward SQL into the tool's input; the tool applies it to prod and records it in `supabase_migrations.schema_migrations`.

The author is responsible for confirming the applied row matches the file on disk.

### Rule 6 — Advisor lint after every apply

Immediately after `apply_migration` succeeds, run the Supabase MCP `get_advisors` tool twice — once with `type: "performance"`, once with `type: "security"`.

Triage every finding into one of three buckets:

- **Fix now:** a real defect that can be fixed in under 15 minutes. Write a new migration immediately.
- **Accept with ADR:** an architectural lint that the project knowingly accepts (e.g. the 13× "authenticated can execute SECURITY DEFINER" warnings covered by ADR 0002). Link to the ADR in PR notes and move on.
- **Punt to Phase 5:** a performance lint that has no prod impact at current scale (e.g. unused index warnings on tables with <1k rows). Add to the Phase 5 backlog.

## Critical surfaces covered

- `supabase/migrations/` — forward migration files (one per change, timestamped)
- `supabase/sql/rollbacks/` — rollback companion files + `README.md` inventory
- Supabase MCP tools `apply_migration` and `get_advisors` — the canonical apply + lint loop
- PR template (future) — checklist for new migrations

## Consequences

### Positive

- **Recoverable from a bad migration.** A prepared rollback runs in seconds; writing one fresh under incident pressure takes minutes you may not have.
- **History in git matches history in prod.** No drift.
- **Lint regressions caught immediately.** The advisor sweep right after apply is the cheapest possible test.
- **Audit trail.** Every change is reviewed in a PR and applied through a logged tool.

### Negative (and accepted)

- **Two SQL files per change.** Forward + rollback. Mitigated by keeping rollbacks small (often just `DROP FUNCTION` or `ALTER TABLE ... DROP COLUMN`).
- **Manual apply step.** Not fully automated. Accepted as a tradeoff for the free-plan constraint; revisit if/when the project moves to Pro with branching.
- **README inventory drift risk.** Mitigated by Rule 4 (same-commit requirement) and a verification grep at PR-review time.

## Rejected alternatives

### `supabase db push --linked` with branching

The standard Supabase migration workflow. Rejected: requires Pro plan for branching, and the project is intentionally staying on free until Phase 5.

### No rollback files; write a new forward migration to undo

Simpler. Rejected: in an incident, the time from "discover problem" to "ship a new migration through PR review" is far longer than the time to paste a prepared rollback into the SQL editor. Rollbacks pay for themselves the first time prod is on fire.

### Reverse migration via `supabase migration repair --status reverted`

Marks a migration as reverted in the schema_migrations table without executing reverse SQL. Rejected: violates the forward-only principle (Rule 1) and creates a mismatch between git history and applied history.

### Inventory in a database table instead of a README

Easier to query. Rejected: a rollback you need during an incident must be findable when the database itself is the thing on fire.

## Implementation checklist

When adding a new migration:

1. Author `supabase/migrations/<timestamp>_<name>.sql`.
2. Author `supabase/sql/rollbacks/<timestamp+100s>_<name>_rollback.sql` with the standard header comment (Rule 3).
3. Add a row to `supabase/sql/rollbacks/README.md` in the **same commit**.
4. Open PR. Reviewer confirms: forward + rollback + inventory row all present.
5. After merge, apply the forward via Supabase MCP `apply_migration`.
6. Run Supabase MCP `get_advisors` for both performance and security.
7. Triage findings (fix-now / accept-with-ADR / punt-to-Phase-5).

## Verification

When reviewing a PR that adds a migration, confirm:

1. The forward file exists in `supabase/migrations/`.
2. The matching rollback file exists in `supabase/sql/rollbacks/` with the +100s timestamp offset.
3. The rollback file starts with the standard header comment.
4. The README inventory has a row for the new pair.
5. No previously-applied migration has been edited.

## References

- `supabase/migrations/` — forward migration files
- `supabase/sql/rollbacks/` — rollback companion files
- `supabase/sql/rollbacks/README.md` — pair inventory
- Supabase MCP — `apply_migration`, `get_advisors`
- ADR 0001 — Escrow state machine in Postgres
- ADR 0002 — RLS + SECURITY DEFINER as the only escrow path
- ADR 0003 — Auth state hygiene