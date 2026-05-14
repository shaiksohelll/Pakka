-- ============================================================
-- bug/prevent-self-application
-- Tighten the INSERT RLS policy on public.job_applications so that
-- a client cannot apply to their own job.
--
-- Change: adds `AND j.client_id <> auth.uid()` inside the EXISTS
-- subquery of the WITH CHECK predicate.  All other predicates are
-- preserved verbatim.
--
-- The job_worker_not_client CHECK constraint on public.jobs remains
-- as a last-resort defence-in-depth guard.
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
        AND j.client_id <> auth.uid()       -- NEW: block self-application at RLS layer
    ))
  );
