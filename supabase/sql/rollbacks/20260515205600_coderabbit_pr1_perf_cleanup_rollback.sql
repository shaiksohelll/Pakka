-- Recreate the policy that the cleanup defensively dropped, in its
-- original (pre-rename) form. No-op on a live DB where security_hardening
-- already renamed it to jobs_select_visible; restores rollback symmetry
-- for a replay-from-scratch scenario.
CREATE POLICY "jobs_select_client_or_worker_or_open_feed" ON public.jobs
  FOR SELECT
  USING (
    client_id = auth.uid()
    OR worker_id = auth.uid()
    OR (
      status = 'open'::public.job_status
      AND public.is_worker()
    )
  );