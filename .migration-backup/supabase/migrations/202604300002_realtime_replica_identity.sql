-- Fix Realtime filtered subscriptions for milestones/wallets/escrow_ledger.
-- Default REPLICA IDENTITY only writes the PK to WAL, so Supabase Realtime
-- silently drops filtered UPDATEs (e.g. job_id=eq.<uuid>) because the filter
-- column isn't in the replication payload. FULL includes every column.
-- Resolves ADR-0037.

ALTER TABLE milestones REPLICA IDENTITY FULL;
ALTER TABLE wallets REPLICA IDENTITY FULL;
ALTER TABLE escrow_ledger REPLICA IDENTITY FULL;