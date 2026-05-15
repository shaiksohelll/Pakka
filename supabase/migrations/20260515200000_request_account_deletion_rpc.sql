-- request_account_deletion RPC.
-- Soft-deletion request flow: marks profile, notifies admins. Hard deletion
-- is processed manually by an admin (handles refunds of locked balances,
-- cleanup of open jobs, etc.). Tier 1 scope — full hard-delete deferred to
-- admin panel work in Phase 5.

-- Add deletion tracking columns if they don't exist.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE OR REPLACE FUNCTION public.request_account_deletion(reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Mark profile as deletion-requested.
  UPDATE public.profiles
  SET deletion_requested_at = NOW(),
      deletion_reason = reason
  WHERE id = v_user_id;

  -- Notify all admins.
  INSERT INTO public.notifications (recipient_id, type, title, body, data)
  SELECT id,
         'account_deletion_requested',
         'Account deletion requested',
         COALESCE('Reason: ' || reason, 'No reason given'),
         jsonb_build_object('user_id', v_user_id, 'reason', reason)
  FROM public.profiles
  WHERE role = 'admin';
END;
$$;

-- Lock down execution.
REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;