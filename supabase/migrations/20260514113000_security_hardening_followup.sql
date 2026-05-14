-- Follow-up to 20260514111300_security_hardening.sql
-- Closes the last anon-intentional gap: auto_release_milestones
-- should be callable ONLY by service_role (Edge Function), never
-- by authenticated users.

REVOKE EXECUTE ON FUNCTION public.auto_release_milestones()
  FROM authenticated;
