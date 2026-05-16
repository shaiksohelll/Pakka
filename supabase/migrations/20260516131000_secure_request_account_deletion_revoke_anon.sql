-- PostgREST schema exposure implicitly grants EXECUTE to the anon role on
-- every function in the exposed schema unless explicitly revoked. The
-- previous migration's REVOKE ALL FROM PUBLIC does not cover this implicit
-- grant. Defense-in-depth: only authenticated users may call this RPC.

REVOKE EXECUTE ON FUNCTION public.request_account_deletion(text) FROM anon;