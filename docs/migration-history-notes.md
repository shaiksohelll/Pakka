# Migration History Notes

## Date: 2026-06-03

### Context
During the review and integration of PR #19 and PR #20, the local workspace tracking for migrations diverged from the remote (Dev/Staging) database. To clean up the local history, a developer ran `pnpm supabase migration repair --status reverted` on 16+ migrations and then ran `pnpm supabase db push --include-all` against the dev/staging DB.

**Resulting State**: 
- The schema effects of all migrations (from `202604300001` to `20260603100000`) were successfully applied (or already existed) on the Dev DB.
- However, the `schema_migrations` tracking table on the Dev DB had its rows removed by the `repair` command, resulting in Supabase CLI reporting them as "Unapplied" remotely.
- Furthermore, 6 old local mock schemas (`202601010000` through `202601010005`) were present in the migrations folder. These were superseded by `202604260001` which recreated all tables properly, meaning they were functionally present/replaced but historically unapplied.

### Pre-prod Reconciliation Steps Executed
To safely re-sync the history without breaking the functional dev schema, we executed the following steps:

1. **Safety First**: Verified the linked ref was `hibfpvmxynoonzxxdllu` (Dev).
2. **SQL Verification**: Checked directly via SQL that the schema effects for the unapplied migrations were physically present in the database (e.g. `idempotency_keys` table, `withdraw_wallet` function, `dispute_milestone` new auth logic).
3. **Tracking Repair**: Looped through all 30 unapplied timestamps (the 6 early ones + the 24 recent ones) and ran `pnpm supabase migration repair --status applied <timestamp> --linked`.
   - **Why the 6 early ones?**: If left unapplied, `pnpm supabase db push --dry-run` would attempt to apply them and fail since their objects (e.g., `profiles`) were already created by `202604260001`. Marking them as applied bypasses execution and ensures a 100% clean pending queue.
4. **Clean Verification**: Ran `pnpm supabase migration list` and `db push --dry-run` to confirm exactly zero pending migrations.

### Deviation from ADR-0004
- **Context:** ADR-0004 mandates forward-only, immutable migrations applied via `apply_migration`. This reconciliation deviated from that and is scoped strictly as a ONE-TIME, dev/staging-ONLY recovery.
- **What changed:** ONLY the `supabase_migrations.schema_migrations` tracking table (via `migration repair`). No migration files edited, no schema objects altered, no SQL re-run, production never touched.
- **Why it was necessary:** An earlier `migration repair --status reverted` wiped tracking rows for migrations whose schema effects were already live, leaving `db push` unable to proceed. Repairing tracking to reflect reality was the minimal fix.
- **Precedent:** ADR-0004 remains fully in force for all future migrations. This runbook is explicitly NOT a precedent for rewriting PRODUCTION migration history.

### Future Action (Pre-Launch Squash)
Before launching to production, we must squash and rename the local migrations to consolidate the numerous patches into a clean baseline sequence. This squash will cleanly combine the `202601010000` mock schemas and the fragmented PR #1/19/20 fixes into coherent numbered releases (e.g., Phase 1 Schema, Phase 2 Escrow).
Additionally, we will normalize the mixed 12-/14-digit timestamp prefixes (e.g. `202604300001`) to the standard 14-digit `YYYYMMDDHHMMSS` format during this squash.
