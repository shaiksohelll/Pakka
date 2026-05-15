-- Cleanup for coderabbit_pr1_perf (PR #5 review fixes).
--   1. Drop duplicate index on escrow_ledger.job_id (idx_escrow_ledger_job_id
--      pre-existed in create_marketplace_schema; ours was redundant).
--   2. Rename new FK indexes to idx_<table>_<column> convention.
--   3. Defensive drop of pre-rename policy name (no-op on live DB; protects
--      replay-from-scratch against policy widening).

-- 1. Drop duplicate index.
DROP INDEX IF EXISTS public.escrow_ledger_job_id_idx;

-- 2. Rename FK indexes.
ALTER INDEX IF EXISTS public.escrow_ledger_from_wallet_idx
  RENAME TO idx_escrow_ledger_from_wallet;
ALTER INDEX IF EXISTS public.escrow_ledger_to_wallet_idx
  RENAME TO idx_escrow_ledger_to_wallet;

-- 3. Defensive drop of pre-rename policy name.
DROP POLICY IF EXISTS "jobs_select_client_or_worker_or_open_feed" ON public.jobs;