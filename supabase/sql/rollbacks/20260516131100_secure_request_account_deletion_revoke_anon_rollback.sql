-- Rollback: restore anon EXECUTE (do not use; this re-opens a security gap).
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO anon;