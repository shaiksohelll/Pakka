Title: ADR-0004: Auto-release cadence
Status: Proposed
Context:

- Milestones should auto-release after a fixed window if no dispute exists to prevent funds from staying locked indefinitely.
Decision:
- Schedule `auto_release_milestones()` via `pg_cron` (database-native scheduler) with a cron expression of `*/5 * * * *`. The job is registered in `supabase/migrations/20260518225500_schedule_auto_release_cron.sql`, which is the source of truth. This replaces the originally considered Edge Function cron approach.

Consequences:
- Auto-release runs inside the database transaction boundary (no cold-start latency, no separate Edge Function deploy). Idempotency is enforced by the `auto_release_milestones()` function itself. Monitoring must target `cron.job_run_details` rather than Edge Function logs.
