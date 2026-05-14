-- ============================================================
-- ROLLBACK: bug/prevent-self-application
-- Restores job_applications_insert_worker_on_open_jobs to its
-- pre-fix state (no j.client_id <> auth.uid() clause).
--
-- DO NOT apply unless rolling back 20260514164000_prevent_self_application.sql
-- ============================================================

DROP POLICY IF EXISTS job_applications_insert_worker_on_open_jobs ON public.job_applications;

CREATE POLICY job_applications_insert_worker_on_open_jobs ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    (worker_id = auth.uid())
    AND (EXISTS (
      SELECT 1
      FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.status = 'open'::job_status
    ))
  );
