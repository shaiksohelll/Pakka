-- ADR-0037 (Part 2): extend REPLICA IDENTITY FULL coverage to tables that were
-- missing from the first migration (202604300002_realtime_replica_identity.sql).
-- Without REPLICA IDENTITY FULL, filtered Realtime subscriptions on these tables
-- silently drop events because Postgres only includes the primary key in the WAL
-- change record, making the job_id/worker_id filter columns unavailable.

ALTER TABLE public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE public.jobs             REPLICA IDENTITY FULL;
ALTER TABLE public.notifications    REPLICA IDENTITY FULL;
ALTER TABLE public.disputes         REPLICA IDENTITY FULL;

-- Idempotent: add tables to the supabase_realtime publication only if not already present.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.job_applications,
    public.jobs,
    public.notifications,
    public.disputes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
