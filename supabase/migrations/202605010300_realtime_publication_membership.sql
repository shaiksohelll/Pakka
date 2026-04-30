-- Add tables to the supabase_realtime publication so Realtime actually emits events.
-- REPLICA IDENTITY FULL alone is necessary but not sufficient — without publication
-- membership, postgres_changes never fires.

-- Drop-then-add is idempotent; re-running this migration is safe.
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.milestones;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.wallets;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.escrow_ledger;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.job_applications;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.jobs;

ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Verify
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('milestones', 'wallets', 'escrow_ledger', 'job_applications', 'jobs')
ORDER BY tablename;