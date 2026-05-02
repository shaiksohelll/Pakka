-- ADR-0034: SECURITY DEFINER RPC for reading counterparty worker names and
-- trust tiers from a client session.
--
-- Problem: profiles RLS only allows a user to read their own row. A client
-- fetching worker names/tiers for their job applications with a plain
-- .from('profiles').in('id', workerIds) call returns empty — not an error —
-- so the UI silently renders "Worker" / "Bronze" as fallbacks.
--
-- Solution: a SECURITY DEFINER function that bypasses RLS but applies its own
-- business-level guard: only return workers where the calling client has an
-- active (non-rejected) job_applications row, ensuring no cross-client data leak.

CREATE OR REPLACE FUNCTION public.get_application_worker_summary(
  worker_ids uuid[]
)
RETURNS TABLE (
  id              uuid,
  full_name       text,
  trust_tier      public.trust_tier,
  rating          numeric,
  jobs_completed  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.full_name,
    wp.trust_tier,
    wp.rating,
    wp.jobs_completed
  FROM public.profiles p
  LEFT JOIN public.worker_profiles wp ON wp.profile_id = p.id
  WHERE p.id = ANY(worker_ids)
    -- Scope guard: only expose workers the caller has an active application with
    AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = p.id
        AND j.client_id  = auth.uid()
        AND ja.status   <> 'rejected'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_worker_summary(uuid[]) TO authenticated;
