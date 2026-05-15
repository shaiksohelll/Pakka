-- Rollback for coderabbit_pr1_perf.sql.
-- Restores policies to un-wrapped auth.uid() form. Drops the FK indexes
-- we created. NOT APPLIED via tooling; manual rollback only if needed.

-- ========== Part 2 rollback first: drop indexes ==========

DROP INDEX IF EXISTS public.escrow_ledger_from_wallet_idx;
DROP INDEX IF EXISTS public.escrow_ledger_to_wallet_idx;
DROP INDEX IF EXISTS public.escrow_ledger_job_id_idx;

-- ========== Part 1 rollback: restore unwrapped auth.uid() policies ==========
-- (Same DROP+CREATE structure, just without the (SELECT ...) wrap.)

-- disputes
DROP POLICY IF EXISTS "disputes_insert_participants" ON public.disputes;
CREATE POLICY "disputes_insert_participants" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK ((raised_by = auth.uid()) AND is_job_participant(job_id));

-- idempotency_keys
DROP POLICY IF EXISTS "idempotency_keys_owner_insert" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_owner_insert" ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "idempotency_keys_owner_select" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_owner_select" ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- job_applications
DROP POLICY IF EXISTS "job_applications_insert_worker_on_open_jobs" ON public.job_applications;
CREATE POLICY "job_applications_insert_worker_on_open_jobs" ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    (worker_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.status = 'open'::job_status
        AND j.client_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "job_applications_select_by_client" ON public.job_applications;
CREATE POLICY "job_applications_select_by_client" ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_applications.job_id
        AND jobs.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "job_applications_select_visible_to_owner_or_worker" ON public.job_applications;
CREATE POLICY "job_applications_select_visible_to_owner_or_worker" ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    (worker_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "job_applications_update_owner_or_client" ON public.job_applications;
CREATE POLICY "job_applications_update_owner_or_client" ON public.job_applications
  FOR UPDATE TO authenticated
  USING (
    (worker_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.client_id = auth.uid()
    )
  )
  WITH CHECK (
    (worker_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.client_id = auth.uid()
    )
  );

-- jobs
DROP POLICY IF EXISTS "jobs_delete_client" ON public.jobs;
CREATE POLICY "jobs_delete_client" ON public.jobs
  FOR DELETE TO authenticated
  USING (
    (client_id = auth.uid())
    AND (status = ANY (ARRAY['draft'::job_status, 'cancelled'::job_status]))
  );

DROP POLICY IF EXISTS "jobs_insert_client" ON public.jobs;
CREATE POLICY "jobs_insert_client" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK ((client_id = auth.uid()) AND (worker_id IS NULL));

DROP POLICY IF EXISTS "jobs_select_visible" ON public.jobs;
CREATE POLICY "jobs_select_visible" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    (client_id = auth.uid())
    OR (worker_id = auth.uid())
    OR (status = 'open'::job_status)
  );

DROP POLICY IF EXISTS "jobs_update_client" ON public.jobs;
CREATE POLICY "jobs_update_client" ON public.jobs
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- materials
DROP POLICY IF EXISTS "materials_insert_participants" ON public.materials;
CREATE POLICY "materials_insert_participants" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = materials.job_id
        AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "materials_select_participants" ON public.materials;
CREATE POLICY "materials_select_participants" ON public.materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = materials.job_id
        AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "materials_update_participants" ON public.materials;
CREATE POLICY "materials_update_participants" ON public.materials
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = materials.job_id
        AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = materials.job_id
        AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid()))
    )
  );

-- milestones
DROP POLICY IF EXISTS "milestones_insert_client_owner" ON public.milestones;
CREATE POLICY "milestones_insert_client_owner" ON public.milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = milestones.job_id
        AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "milestones_update_client_owner" ON public.milestones;
CREATE POLICY "milestones_update_client_owner" ON public.milestones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = milestones.job_id
        AND j.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = milestones.job_id
        AND j.client_id = auth.uid()
    )
  );

-- notifications
DROP POLICY IF EXISTS "notifications_recipient_select" ON public.notifications;
CREATE POLICY "notifications_recipient_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_recipient_update" ON public.notifications;
CREATE POLICY "notifications_recipient_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- proofs
DROP POLICY IF EXISTS "proofs_insert_assigned_worker" ON public.proofs;
CREATE POLICY "proofs_insert_assigned_worker" ON public.proofs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM milestones m
      JOIN jobs j ON j.id = m.job_id
      WHERE m.id = proofs.milestone_id
        AND j.worker_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "proofs_select_participants" ON public.proofs;
CREATE POLICY "proofs_select_participants" ON public.proofs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM milestones m
      JOIN jobs j ON j.id = m.job_id
      WHERE m.id = proofs.milestone_id
        AND ((j.client_id = auth.uid()) OR (j.worker_id = auth.uid()))
    )
  );

-- wallets
DROP POLICY IF EXISTS "wallets_owner_select" ON public.wallets;
CREATE POLICY "wallets_owner_select" ON public.wallets
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- worker_profiles
DROP POLICY IF EXISTS "worker_profiles_self_insert" ON public.worker_profiles;
CREATE POLICY "worker_profiles_self_insert" ON public.worker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "worker_profiles_self_select" ON public.worker_profiles;
CREATE POLICY "worker_profiles_self_select" ON public.worker_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "worker_profiles_self_update" ON public.worker_profiles;
CREATE POLICY "worker_profiles_self_update" ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());