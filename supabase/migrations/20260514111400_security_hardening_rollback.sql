-- =============================================================================
-- ROLLBACK: security_hardening (20260514111300)
-- Reverts all changes from the forward migration.
-- Run ONLY if the forward migration causes a regression.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: FUNCTION GRANTS — restore EXECUTE to PUBLIC for all 20 functions
-- =============================================================================

-- Bucket 1: cron/service-only → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.auto_release_milestones() TO PUBLIC;

-- Bucket 2: admin functions → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_release(uuid, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund(uuid, text) TO PUBLIC;

-- Bucket 3: escrow state-machine → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_milestone(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_milestone(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispute_milestone(uuid, text) TO PUBLIC;

-- Bucket 4: RLS predicate helpers → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_participant(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_worker() TO PUBLIC;

-- Bucket 5: read helpers → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.get_application_worker_summary(uuid[]) TO PUBLIC;

-- Bucket 6: trigger functions → restore PUBLIC
GRANT EXECUTE ON FUNCTION public.guard_disputes_status() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_jobs_status() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_milestones_status() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_worker_profile_columns() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_wallet_for_profile() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_milestone_status_change() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_wallet_updated_at() TO PUBLIC;

-- =============================================================================
-- PART 2: RLS POLICIES — restore original TO {public} targets
-- 41 policies total. 3 policies not touched by forward migration are omitted:
--   jobs_select_visible (already {authenticated}),
--   escrow_ledger_insert_service_role ({service_role}),
--   notifications_system_insert ({service_role}).
-- =============================================================================

-- ── disputes (4 policies) ───────────────────────────────────────────────────

DROP POLICY IF EXISTS disputes_admin_all ON public.disputes;
CREATE POLICY disputes_admin_all ON public.disputes
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS disputes_insert_participants ON public.disputes;
CREATE POLICY disputes_insert_participants ON public.disputes
  FOR INSERT TO PUBLIC
  WITH CHECK ((raised_by = auth.uid()) AND is_job_participant(job_id));

DROP POLICY IF EXISTS disputes_select_participants ON public.disputes;
CREATE POLICY disputes_select_participants ON public.disputes
  FOR SELECT TO PUBLIC USING (is_job_participant(job_id));

DROP POLICY IF EXISTS disputes_update_participants ON public.disputes;
CREATE POLICY disputes_update_participants ON public.disputes
  FOR UPDATE TO PUBLIC
  USING (is_job_participant(job_id)) WITH CHECK (is_job_participant(job_id));

-- ── escrow_ledger (2 policies) ──────────────────────────────────────────────

DROP POLICY IF EXISTS escrow_ledger_admin_all ON public.escrow_ledger;
CREATE POLICY escrow_ledger_admin_all ON public.escrow_ledger
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS escrow_ledger_select_job_participants ON public.escrow_ledger;
CREATE POLICY escrow_ledger_select_job_participants ON public.escrow_ledger
  FOR SELECT TO PUBLIC USING (is_job_participant(job_id));

-- ── idempotency_keys (2 policies) ──────────────────────────────────────────

DROP POLICY IF EXISTS idempotency_keys_owner_insert ON public.idempotency_keys;
CREATE POLICY idempotency_keys_owner_insert ON public.idempotency_keys
  FOR INSERT TO PUBLIC WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS idempotency_keys_owner_select ON public.idempotency_keys;
CREATE POLICY idempotency_keys_owner_select ON public.idempotency_keys
  FOR SELECT TO PUBLIC USING (user_id = auth.uid());

-- ── job_applications (5 policies) ──────────────────────────────────────────

DROP POLICY IF EXISTS job_applications_admin_all ON public.job_applications;
CREATE POLICY job_applications_admin_all ON public.job_applications
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS job_applications_insert_worker_on_open_jobs ON public.job_applications;
CREATE POLICY job_applications_insert_worker_on_open_jobs ON public.job_applications
  FOR INSERT TO PUBLIC
  WITH CHECK (
    (worker_id = auth.uid()) AND (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.status = 'open'::job_status))))
  );

DROP POLICY IF EXISTS job_applications_select_by_client ON public.job_applications;
CREATE POLICY job_applications_select_by_client ON public.job_applications
  FOR SELECT TO PUBLIC
  USING (EXISTS ( SELECT 1
     FROM jobs
    WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid()))));

DROP POLICY IF EXISTS job_applications_select_visible_to_owner_or_worker ON public.job_applications;
CREATE POLICY job_applications_select_visible_to_owner_or_worker ON public.job_applications
  FOR SELECT TO PUBLIC
  USING (
    (worker_id = auth.uid()) OR (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.client_id = auth.uid()))))
  );

DROP POLICY IF EXISTS job_applications_update_owner_or_client ON public.job_applications;
CREATE POLICY job_applications_update_owner_or_client ON public.job_applications
  FOR UPDATE TO PUBLIC
  USING (
    (worker_id = auth.uid()) OR (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.client_id = auth.uid()))))
  )
  WITH CHECK (
    (worker_id = auth.uid()) OR (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.client_id = auth.uid()))))
  );

-- ── jobs (4 policies — jobs_select_visible stays {authenticated}) ───────────

DROP POLICY IF EXISTS jobs_admin_all ON public.jobs;
CREATE POLICY jobs_admin_all ON public.jobs
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS jobs_delete_client ON public.jobs;
CREATE POLICY jobs_delete_client ON public.jobs
  FOR DELETE TO PUBLIC
  USING ((client_id = auth.uid()) AND (status = ANY (ARRAY['draft'::job_status, 'cancelled'::job_status])));

DROP POLICY IF EXISTS jobs_insert_client ON public.jobs;
CREATE POLICY jobs_insert_client ON public.jobs
  FOR INSERT TO PUBLIC
  WITH CHECK ((client_id = auth.uid()) AND (worker_id IS NULL));

DROP POLICY IF EXISTS jobs_update_client_or_assigned_worker ON public.jobs;
CREATE POLICY jobs_update_client_or_assigned_worker ON public.jobs
  FOR UPDATE TO PUBLIC
  USING ((client_id = auth.uid()) OR (worker_id = auth.uid()))
  WITH CHECK ((client_id = auth.uid()) OR (worker_id = auth.uid()));

-- ── materials (4 policies) ──────────────────────────────────────────────────

DROP POLICY IF EXISTS materials_admin_all ON public.materials;
CREATE POLICY materials_admin_all ON public.materials
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS materials_insert_participants ON public.materials;
CREATE POLICY materials_insert_participants ON public.materials
  FOR INSERT TO PUBLIC
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

DROP POLICY IF EXISTS materials_select_participants ON public.materials;
CREATE POLICY materials_select_participants ON public.materials
  FOR SELECT TO PUBLIC
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

DROP POLICY IF EXISTS materials_update_participants ON public.materials;
CREATE POLICY materials_update_participants ON public.materials
  FOR UPDATE TO PUBLIC
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- ── milestones (4 policies) ─────────────────────────────────────────────────

DROP POLICY IF EXISTS milestones_admin_all ON public.milestones;
CREATE POLICY milestones_admin_all ON public.milestones
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS milestones_insert_client_owner ON public.milestones;
CREATE POLICY milestones_insert_client_owner ON public.milestones
  FOR INSERT TO PUBLIC
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))));

DROP POLICY IF EXISTS milestones_select_participants ON public.milestones;
CREATE POLICY milestones_select_participants ON public.milestones
  FOR SELECT TO PUBLIC USING (is_job_participant(job_id));

DROP POLICY IF EXISTS milestones_update_client_owner ON public.milestones;
CREATE POLICY milestones_update_client_owner ON public.milestones
  FOR UPDATE TO PUBLIC
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))));

-- ── notifications (3 policies — system_insert stays {service_role}) ─────────

DROP POLICY IF EXISTS notifications_admin_all ON public.notifications;
CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS notifications_recipient_select ON public.notifications;
CREATE POLICY notifications_recipient_select ON public.notifications
  FOR SELECT TO PUBLIC USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update ON public.notifications
  FOR UPDATE TO PUBLIC
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- ── profiles (4 policies) ───────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO PUBLIC WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO PUBLIC USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO PUBLIC
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── proofs (3 policies) ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS proofs_admin_all ON public.proofs;
CREATE POLICY proofs_admin_all ON public.proofs
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS proofs_insert_assigned_worker ON public.proofs;
CREATE POLICY proofs_insert_assigned_worker ON public.proofs
  FOR INSERT TO PUBLIC
  WITH CHECK (EXISTS ( SELECT 1
     FROM (milestones m
       JOIN jobs j ON ((j.id = m.job_id)))
    WHERE ((m.id = proofs.milestone_id) AND (j.worker_id = auth.uid()))));

DROP POLICY IF EXISTS proofs_select_participants ON public.proofs;
CREATE POLICY proofs_select_participants ON public.proofs
  FOR SELECT TO PUBLIC
  USING (EXISTS ( SELECT 1
     FROM (milestones m
       JOIN jobs j ON ((j.id = m.job_id)))
    WHERE ((m.id = proofs.milestone_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- ── wallets (2 policies) ────────────────────────────────────────────────────

DROP POLICY IF EXISTS wallets_admin_all ON public.wallets;
CREATE POLICY wallets_admin_all ON public.wallets
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS wallets_owner_select ON public.wallets;
CREATE POLICY wallets_owner_select ON public.wallets
  FOR SELECT TO PUBLIC USING (profile_id = auth.uid());

-- ── worker_profiles (4 policies) ────────────────────────────────────────────

DROP POLICY IF EXISTS worker_profiles_admin_all ON public.worker_profiles;
CREATE POLICY worker_profiles_admin_all ON public.worker_profiles
  FOR ALL TO PUBLIC USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS worker_profiles_self_insert ON public.worker_profiles;
CREATE POLICY worker_profiles_self_insert ON public.worker_profiles
  FOR INSERT TO PUBLIC WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS worker_profiles_self_select ON public.worker_profiles;
CREATE POLICY worker_profiles_self_select ON public.worker_profiles
  FOR SELECT TO PUBLIC USING (profile_id = auth.uid());

DROP POLICY IF EXISTS worker_profiles_self_update ON public.worker_profiles;
CREATE POLICY worker_profiles_self_update ON public.worker_profiles
  FOR UPDATE TO PUBLIC
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

COMMIT;
