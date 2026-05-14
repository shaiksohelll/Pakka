-- Phase 1 RLS policies (high level)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON_profiles FOR SELECT USING (id = auth.uid());

-- Wallets: only owner can read; no direct writes (mutations via SECURITY DEFINER)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_read_by_owner" ON wallets FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "wallets_writes_disabled" ON wallets FOR UPDATE USING (false) WITH CHECK (false);

-- Jobs: clients see their jobs; workers see open jobs and their assigned jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_read_by_owner_or_open" ON jobs FOR SELECT USING (
  client_id = auth.uid() OR worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles rp WHERE rp.id = auth.uid() AND rp.role = 'admin') OR status = 'open'
);
CREATE POLICY "jobs_write_by_owner" ON jobs FOR UPDATE USING (
  client_id = auth.uid() OR worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Milestones: access only to participants of the parent job
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones_read_by_participants" ON milestones FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs j WHERE j.id = milestones.job_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid()))
);

-- Proofs, disputes, materials, job_applications, notifications: similar ownership checks
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proofs_read_by_participants" ON proofs FOR SELECT USING (
  EXISTS (SELECT 1 FROM milestones m JOIN jobs j ON m.job_id = j.id WHERE m.id = proofs.milestone_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid()))
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes_read_by_participants" ON disputes FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs j WHERE j.id = disputes.job_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid()))
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_read_by_participants" ON materials FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs j WHERE j.id = materials.job_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid()))
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_read_by_owner" ON job_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_applications.job_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid()))
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_by_user" ON notifications FOR SELECT USING (recipient_id = auth.uid());
