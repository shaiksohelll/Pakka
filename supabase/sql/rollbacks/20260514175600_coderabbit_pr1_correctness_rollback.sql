-- ============================================================
-- ROLLBACK: fix/coderabbit-pr1-correctness
-- Restores the original jobs UPDATE policy and trigger definition.
-- See supabase/sql/rollbacks/README.md for emergency procedure.
--
-- DO NOT apply unless rolling back
-- 20260514175500_coderabbit_pr1_correctness.sql
-- ============================================================

-- ── Restore Q1: combined client+worker UPDATE policy ─────────────────────────
DROP POLICY IF EXISTS jobs_update_client ON public.jobs;

CREATE POLICY jobs_update_client_or_assigned_worker ON public.jobs
  FOR UPDATE TO authenticated
  USING  ((client_id = auth.uid()) OR (worker_id = auth.uid()))
  WITH CHECK ((client_id = auth.uid()) OR (worker_id = auth.uid()));

-- ── Restore Q14: trigger without WHEN clause ─────────────────────────────────
DROP TRIGGER IF EXISTS guard_jobs_status ON public.jobs;

CREATE TRIGGER guard_jobs_status
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION guard_jobs_status();
