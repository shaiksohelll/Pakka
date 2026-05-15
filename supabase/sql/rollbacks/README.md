# Rollback SQL scripts

Insurance-only rollbacks for applied production migrations.
Deliberately OUT of `supabase/migrations/` so the Supabase migration
CLI will never auto-apply them.

Naming: matches the original forward migration filename with a
`_rollback.sql` suffix and the timestamp of when the rollback was
authored (NOT the time of any emergency execution).

## Emergency rollback procedure

1. Identify the forward migration in `supabase/migrations/` whose
   effects need to be reversed.
2. Run the matching rollback in this directory MANUALLY via the
   Supabase Studio SQL Editor or `psql` against the linked project.
   DO NOT use `apply_migration` or `supabase db push`.
3. Manually delete the forward migration's row from
   `supabase_migrations.schema_migrations` so the migration stream
   stays in lockstep with the live schema.
4. Open a follow-up FORWARD migration documenting the correction.
   NEVER edit applied migration files.

## Current inventory

- `20260514111400_security_hardening_rollback.sql`
  Reverses PR #2 security hardening (anon EXECUTE revokes,
  41 policy retargets, trigger function lockdowns).
- `20260514164100_prevent_self_application_rollback.sql`
  Reverses PR #3 self-application RLS guard.
- `20260514175600_coderabbit_pr1_correctness_rollback.sql`
  Reverses PR #4 CodeRabbit fixes (jobs UPDATE policy restriction,
  trigger WHEN clause).
- `20260515183100_coderabbit_pr1_perf_rollback.sql` — Reverts perf migration (RLS init-plan wraps + 3 FK indexes). Not applied.
- `20260515205600_coderabbit_pr1_perf_cleanup_rollback.sql` — Reverts cleanup (recreates duplicate index, reverts index renames). Not applied.
- `20260515200100_request_account_deletion_rpc_rollback.sql` — Rollback for request_account_deletion RPC (drops function, keeps additive columns).