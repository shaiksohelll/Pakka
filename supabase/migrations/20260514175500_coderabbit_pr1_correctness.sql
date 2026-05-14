-- ============================================================
-- fix/coderabbit-pr1-correctness
-- Addresses 2 DB-layer findings from CodeRabbit PR #1 triage:
--
-- Q1: jobs UPDATE policy too permissive — workers can rewrite any
--     column (title, budget, status, etc.). Fix: restrict UPDATE
--     policy to client-only. Workers mutate jobs exclusively via
--     SECURITY DEFINER RPCs (fund_escrow, submit_milestone,
--     approve_milestone, etc.) which bypass RLS.
--
-- Q14: guard_jobs_status trigger fires on every UPDATE even when
--      status hasn't changed. Fix: add WHEN clause at the trigger
--      level so Postgres skips the function call entirely for
--      non-status updates (perf).
-- ============================================================

-- ── Q1: Restrict jobs UPDATE to client-only ──────────────────────────────────
-- Workers never need direct UPDATE access to the jobs table:
-- - status transitions → handled by SECURITY DEFINER RPCs
-- - worker_id assignment → handled by accept_worker Server Action via RPC
-- The admin path is already covered by jobs_admin_all (FOR ALL).

DROP POLICY IF EXISTS jobs_update_client_or_assigned_worker ON public.jobs;

CREATE POLICY jobs_update_client ON public.jobs
  FOR UPDATE TO authenticated
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- ── Q14: Add WHEN clause to guard_jobs_status trigger ────────────────────────
-- The function body already checks `new.status IS DISTINCT FROM old.status`,
-- but without WHEN on the trigger itself, Postgres enters the function for
-- every UPDATE row (budget edits, description edits, etc.) only to RETURN NEW
-- immediately. The WHEN clause avoids the function-call overhead entirely.

DROP TRIGGER IF EXISTS guard_jobs_status ON public.jobs;

CREATE TRIGGER guard_jobs_status
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION guard_jobs_status();
