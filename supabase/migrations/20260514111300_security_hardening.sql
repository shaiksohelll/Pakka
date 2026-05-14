-- =============================================================================
-- SECURITY HARDENING MIGRATION
-- Fixes all 54 Supabase advisor findings:
--   - 20x anon_security_definer_function_executable  (lint 0028)
--   - 20x authenticated_security_definer_function_executable (lint 0029)
--   - 13x auth_allow_anonymous_sign_ins (lint 0012)
--   - 1x  auth_leaked_password_protection (not fixable via SQL)
--
-- Design: single transaction, no partial state.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: FUNCTION GRANTS
-- Strategy: REVOKE from PUBLIC (which covers anon), then GRANT per bucket.
-- Note: REVOKE FROM PUBLIC also revokes from anon implicitly.
-- We also explicitly revoke from anon for clarity.
-- =============================================================================

-- ── Bucket 1: CRON / SERVICE-ONLY ───────────────────────────────────────────
-- auto_release_milestones: intended to be called by an Edge Function (Deno)
-- using the service_role key, or future pg_cron job (pg_cron v1.6.4 available
-- but not installed). Local source: supabase/functions/auto_release_milestones/
-- index.ts (currently a scaffold). No cron.job rows exist. The Edge Function
-- is NOT deployed yet. Grant service_role only.
REVOKE EXECUTE ON FUNCTION public.auto_release_milestones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_release_milestones() TO service_role;

-- ── Bucket 2: ADMIN FUNCTIONS ───────────────────────────────────────────────
-- Internal is_admin() guard prevents non-admins from mutating.
-- Grant to authenticated so admin users can call via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.admin_approve_kyc(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_reject_kyc(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_force_release(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_force_release(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_refund(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund(uuid, text) TO authenticated;

-- ── Bucket 3: ESCROW STATE-MACHINE FUNCTIONS ────────────────────────────────
-- Called by authenticated clients/workers via Server Actions → RPC.
-- Internal auth.uid() guards handle authorization.
REVOKE EXECUTE ON FUNCTION public.fund_escrow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_milestone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_milestone(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_milestone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispute_milestone(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispute_milestone(uuid, text) TO authenticated;

-- ── Bucket 4: RLS PREDICATE HELPERS ─────────────────────────────────────────
-- Used inside USING/WITH CHECK clauses. Must remain executable by
-- authenticated role so policy evaluation works. Safe to revoke anon:
-- all policies referencing these are also being re-targeted to authenticated.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_job_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_job_participant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_worker() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_worker() TO authenticated;

-- ── Bucket 5: READ HELPERS ──────────────────────────────────────────────────
-- Called by authenticated client-side Realtime enrichment (toast worker name).
REVOKE EXECUTE ON FUNCTION public.get_application_worker_summary(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_application_worker_summary(uuid[]) TO authenticated;

-- ── Bucket 6: TRIGGER FUNCTIONS ─────────────────────────────────────────────
-- These return TRIGGER and can't be meaningfully called via PostgREST RPC,
-- but revoking anon EXECUTE silences the advisor finding.
-- Bound triggers: guard_disputes_status → disputes, guard_jobs_status → jobs,
-- guard_milestones_status → milestones, guard_worker_profile_columns → worker_profiles,
-- create_wallet_for_profile → profiles, notify_milestone_status_change → milestones,
-- touch_wallet_updated_at → wallets.
REVOKE EXECUTE ON FUNCTION public.guard_disputes_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_jobs_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_milestones_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_worker_profile_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_wallet_for_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_milestone_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_wallet_updated_at() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- PART 2: RLS POLICIES — retarget {public} → {authenticated}
-- Strategy: DROP + CREATE preserving USING/WITH CHECK verbatim.
-- Policies already targeting {authenticated} or {service_role} are left as-is.
--
-- Skipped (already correct):
--   jobs_select_visible              → {authenticated} ✓
--   escrow_ledger_insert_service_role → {service_role}  ✓
--   notifications_system_insert      → {service_role}  ✓
-- =============================================================================

-- ── disputes (3 of 4 policies) ──────────────────────────────────────────────

-- OLD: disputes_admin_all TO {public} USING is_admin() WITH CHECK is_admin()
DROP POLICY IF EXISTS disputes_admin_all ON public.disputes;
CREATE POLICY disputes_admin_all ON public.disputes
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: disputes_insert_participants TO {public} WITH CHECK ((raised_by = auth.uid()) AND is_job_participant(job_id))
DROP POLICY IF EXISTS disputes_insert_participants ON public.disputes;
CREATE POLICY disputes_insert_participants ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK ((raised_by = auth.uid()) AND is_job_participant(job_id));

-- OLD: disputes_select_participants TO {public} USING is_job_participant(job_id)
DROP POLICY IF EXISTS disputes_select_participants ON public.disputes;
CREATE POLICY disputes_select_participants ON public.disputes
  FOR SELECT TO authenticated
  USING (is_job_participant(job_id));

-- OLD: disputes_update_participants TO {public} USING/CHECK is_job_participant(job_id)
DROP POLICY IF EXISTS disputes_update_participants ON public.disputes;
CREATE POLICY disputes_update_participants ON public.disputes
  FOR UPDATE TO authenticated
  USING (is_job_participant(job_id)) WITH CHECK (is_job_participant(job_id));

-- ── escrow_ledger (2 of 3 policies — insert_service_role stays) ─────────────

-- OLD: escrow_ledger_admin_all TO {public} USING is_admin() WITH CHECK is_admin()
DROP POLICY IF EXISTS escrow_ledger_admin_all ON public.escrow_ledger;
CREATE POLICY escrow_ledger_admin_all ON public.escrow_ledger
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: escrow_ledger_select_job_participants TO {public} USING is_job_participant(job_id)
DROP POLICY IF EXISTS escrow_ledger_select_job_participants ON public.escrow_ledger;
CREATE POLICY escrow_ledger_select_job_participants ON public.escrow_ledger
  FOR SELECT TO authenticated
  USING (is_job_participant(job_id));

-- ── idempotency_keys (2 of 2 policies) ──────────────────────────────────────

-- OLD: idempotency_keys_owner_insert TO {public} WITH CHECK (user_id = auth.uid())
DROP POLICY IF EXISTS idempotency_keys_owner_insert ON public.idempotency_keys;
CREATE POLICY idempotency_keys_owner_insert ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- OLD: idempotency_keys_owner_select TO {public} USING (user_id = auth.uid())
DROP POLICY IF EXISTS idempotency_keys_owner_select ON public.idempotency_keys;
CREATE POLICY idempotency_keys_owner_select ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── job_applications (5 of 5 policies) ──────────────────────────────────────

-- OLD: job_applications_admin_all TO {public} USING is_admin() WITH CHECK is_admin()
DROP POLICY IF EXISTS job_applications_admin_all ON public.job_applications;
CREATE POLICY job_applications_admin_all ON public.job_applications
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: job_applications_insert_worker_on_open_jobs TO {public}
DROP POLICY IF EXISTS job_applications_insert_worker_on_open_jobs ON public.job_applications;
CREATE POLICY job_applications_insert_worker_on_open_jobs ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    (worker_id = auth.uid()) AND (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.status = 'open'::job_status))))
  );

-- OLD: job_applications_select_by_client TO {public}
DROP POLICY IF EXISTS job_applications_select_by_client ON public.job_applications;
CREATE POLICY job_applications_select_by_client ON public.job_applications
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM jobs
    WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid()))));

-- OLD: job_applications_select_visible_to_owner_or_worker TO {public}
DROP POLICY IF EXISTS job_applications_select_visible_to_owner_or_worker ON public.job_applications;
CREATE POLICY job_applications_select_visible_to_owner_or_worker ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    (worker_id = auth.uid()) OR (EXISTS ( SELECT 1
       FROM jobs j
      WHERE ((j.id = job_applications.job_id) AND (j.client_id = auth.uid()))))
  );

-- OLD: job_applications_update_owner_or_client TO {public}
DROP POLICY IF EXISTS job_applications_update_owner_or_client ON public.job_applications;
CREATE POLICY job_applications_update_owner_or_client ON public.job_applications
  FOR UPDATE TO authenticated
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

-- ── jobs (4 of 5 policies — jobs_select_visible already {authenticated}) ────

-- OLD: jobs_admin_all TO {public} USING is_admin() WITH CHECK is_admin()
DROP POLICY IF EXISTS jobs_admin_all ON public.jobs;
CREATE POLICY jobs_admin_all ON public.jobs
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: jobs_delete_client TO {public}
DROP POLICY IF EXISTS jobs_delete_client ON public.jobs;
CREATE POLICY jobs_delete_client ON public.jobs
  FOR DELETE TO authenticated
  USING ((client_id = auth.uid()) AND (status = ANY (ARRAY['draft'::job_status, 'cancelled'::job_status])));

-- OLD: jobs_insert_client TO {public}
DROP POLICY IF EXISTS jobs_insert_client ON public.jobs;
CREATE POLICY jobs_insert_client ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK ((client_id = auth.uid()) AND (worker_id IS NULL));

-- OLD: jobs_update_client_or_assigned_worker TO {public}
DROP POLICY IF EXISTS jobs_update_client_or_assigned_worker ON public.jobs;
CREATE POLICY jobs_update_client_or_assigned_worker ON public.jobs
  FOR UPDATE TO authenticated
  USING ((client_id = auth.uid()) OR (worker_id = auth.uid()))
  WITH CHECK ((client_id = auth.uid()) OR (worker_id = auth.uid()));

-- ── materials (3 of 4 policies) ─────────────────────────────────────────────

-- OLD: materials_admin_all TO {public}
DROP POLICY IF EXISTS materials_admin_all ON public.materials;
CREATE POLICY materials_admin_all ON public.materials
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: materials_insert_participants TO {public}
DROP POLICY IF EXISTS materials_insert_participants ON public.materials;
CREATE POLICY materials_insert_participants ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- OLD: materials_select_participants TO {public}
DROP POLICY IF EXISTS materials_select_participants ON public.materials;
CREATE POLICY materials_select_participants ON public.materials
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- OLD: materials_update_participants TO {public}
DROP POLICY IF EXISTS materials_update_participants ON public.materials;
CREATE POLICY materials_update_participants ON public.materials
  FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = materials.job_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- ── milestones (3 of 4 policies) ────────────────────────────────────────────

-- OLD: milestones_admin_all TO {public}
DROP POLICY IF EXISTS milestones_admin_all ON public.milestones;
CREATE POLICY milestones_admin_all ON public.milestones
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: milestones_insert_client_owner TO {public}
DROP POLICY IF EXISTS milestones_insert_client_owner ON public.milestones;
CREATE POLICY milestones_insert_client_owner ON public.milestones
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))));

-- OLD: milestones_select_participants TO {public}
DROP POLICY IF EXISTS milestones_select_participants ON public.milestones;
CREATE POLICY milestones_select_participants ON public.milestones
  FOR SELECT TO authenticated
  USING (is_job_participant(job_id));

-- OLD: milestones_update_client_owner TO {public}
DROP POLICY IF EXISTS milestones_update_client_owner ON public.milestones;
CREATE POLICY milestones_update_client_owner ON public.milestones
  FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))))
  WITH CHECK (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.id = milestones.job_id) AND (j.client_id = auth.uid()))));

-- ── notifications (2 of 4 policies — system_insert stays service_role) ──────

-- OLD: notifications_admin_all TO {public}
DROP POLICY IF EXISTS notifications_admin_all ON public.notifications;
CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: notifications_recipient_select TO {public}
DROP POLICY IF EXISTS notifications_recipient_select ON public.notifications;
CREATE POLICY notifications_recipient_select ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- OLD: notifications_recipient_update TO {public}
DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- ── profiles (3 of 4 policies) ──────────────────────────────────────────────
-- profiles_self_insert: safe to move to authenticated — profile rows are
-- created during onboarding (Server Actions) AFTER phone OTP verification.

-- OLD: profiles_admin_all TO {public}
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: profiles_self_insert TO {public}
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- OLD: profiles_self_select TO {public}
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- OLD: profiles_self_update TO {public}
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── proofs (2 of 3 policies) ────────────────────────────────────────────────

-- OLD: proofs_admin_all TO {public}
DROP POLICY IF EXISTS proofs_admin_all ON public.proofs;
CREATE POLICY proofs_admin_all ON public.proofs
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: proofs_insert_assigned_worker TO {public}
DROP POLICY IF EXISTS proofs_insert_assigned_worker ON public.proofs;
CREATE POLICY proofs_insert_assigned_worker ON public.proofs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1
     FROM (milestones m
       JOIN jobs j ON ((j.id = m.job_id)))
    WHERE ((m.id = proofs.milestone_id) AND (j.worker_id = auth.uid()))));

-- OLD: proofs_select_participants TO {public}
DROP POLICY IF EXISTS proofs_select_participants ON public.proofs;
CREATE POLICY proofs_select_participants ON public.proofs
  FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM (milestones m
       JOIN jobs j ON ((j.id = m.job_id)))
    WHERE ((m.id = proofs.milestone_id) AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid())))));

-- ── wallets (1 of 2 policies) ───────────────────────────────────────────────

-- OLD: wallets_admin_all TO {public}
DROP POLICY IF EXISTS wallets_admin_all ON public.wallets;
CREATE POLICY wallets_admin_all ON public.wallets
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: wallets_owner_select TO {public}
DROP POLICY IF EXISTS wallets_owner_select ON public.wallets;
CREATE POLICY wallets_owner_select ON public.wallets
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ── worker_profiles (3 of 4 policies) ───────────────────────────────────────

-- OLD: worker_profiles_admin_all TO {public}
DROP POLICY IF EXISTS worker_profiles_admin_all ON public.worker_profiles;
CREATE POLICY worker_profiles_admin_all ON public.worker_profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- OLD: worker_profiles_self_insert TO {public}
DROP POLICY IF EXISTS worker_profiles_self_insert ON public.worker_profiles;
CREATE POLICY worker_profiles_self_insert ON public.worker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- OLD: worker_profiles_self_select TO {public}
DROP POLICY IF EXISTS worker_profiles_self_select ON public.worker_profiles;
CREATE POLICY worker_profiles_self_select ON public.worker_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- OLD: worker_profiles_self_update TO {public}
DROP POLICY IF EXISTS worker_profiles_self_update ON public.worker_profiles;
CREATE POLICY worker_profiles_self_update ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

COMMIT;

-- =============================================================================
-- PART 3: SMOKE VERIFICATION (read-only, post-commit)
-- =============================================================================

-- Verify: no policies on sensitive tables still target {public}
-- Expected: 0 rows
SELECT schemaname, tablename, policyname, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'wallets','escrow_ledger','milestones','jobs','disputes',
    'profiles','worker_profiles','proofs','notifications',
    'materials','job_applications','idempotency_keys'
  )
  AND roles::text LIKE '%public%';
-- EXPECTED RESULT: 0 rows

-- Verify: no SECURITY DEFINER functions in public schema with anon EXECUTE
-- Expected: 0 rows
SELECT n.nspname, p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname = 'public'
  AND has_function_privilege('anon', p.oid, 'EXECUTE') = true;
-- EXPECTED RESULT: 0 rows

-- Verify: policies that reference modified helper functions still work
-- (is_admin, is_job_participant, is_worker remain executable by authenticated)
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'is_job_participant', 'is_worker');
-- EXPECTED RESULT: 3 rows, all auth_can_execute = true
