-- Rollback for coderabbit_pr1_perf_cleanup.sql. NOT APPLIED.

CREATE INDEX IF NOT EXISTS escrow_ledger_job_id_idx
  ON public.escrow_ledger (job_id);

ALTER INDEX IF EXISTS public.idx_escrow_ledger_from_wallet
  RENAME TO escrow_ledger_from_wallet_idx;
ALTER INDEX IF EXISTS public.idx_escrow_ledger_to_wallet
  RENAME TO escrow_ledger_to_wallet_idx;