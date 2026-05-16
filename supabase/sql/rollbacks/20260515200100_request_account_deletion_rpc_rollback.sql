-- Rollback for request_account_deletion_rpc.sql
REVOKE EXECUTE ON FUNCTION public.request_account_deletion(text) FROM authenticated;
DROP FUNCTION IF EXISTS public.request_account_deletion(text);
-- Intentionally keeping deletion_requested_at / deletion_reason columns
-- since they may contain data and are additive (no breaking change).