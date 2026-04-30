-- Extend Realtime publication coverage to app-level tables
ALTER TABLE job_applications REPLICA IDENTITY FULL;
ALTER TABLE jobs              REPLICA IDENTITY FULL;
-- (notifications and disputes already have FULL identity from earlier migrations;
--  add an idempotent block here only if you discover otherwise during apply)

-- Ensure all five key tables appear in the supabase_realtime publication.
-- ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
-- ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE escrow_ledger;
-- ALTER PUBLICATION supabase_realtime ADD TABLE job_applications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
-- ^ Uncomment individual lines above only if `\dRp+ supabase_realtime` shows the table missing.
--   Supabase Cloud pre-adds all tables; local dev may differ.
