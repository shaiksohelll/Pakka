-- Phase 1 Publication for Realtime (supabase_realtime)
CREATE PUBLICATION supabase_realtime FOR TABLES
  profiles,
  worker_profiles,
  wallets,
  jobs,
  milestones,
  escrow_ledger,
  proofs,
  disputes,
  materials,
  job_applications,
  notifications;

-- Ensure replica identity FULL for realtime subscriptions
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE worker_profiles REPLICA IDENTITY FULL;
ALTER TABLE wallets REPLICA IDENTITY FULL;
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE milestones REPLICA IDENTITY FULL;
ALTER TABLE escrow_ledger REPLICA IDENTITY FULL;
ALTER TABLE proofs REPLICA IDENTITY FULL;
ALTER TABLE disputes REPLICA IDENTITY FULL;
ALTER TABLE materials REPLICA IDENTITY FULL;
ALTER TABLE job_applications REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
