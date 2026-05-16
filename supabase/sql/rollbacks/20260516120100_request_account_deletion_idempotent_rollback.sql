-- Rollback: restore the original non-idempotent version of request_account_deletion.
-- Only use if the idempotency guard causes unforeseen issues.

CREATE OR REPLACE FUNCTION public.request_account_deletion(reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET deletion_requested_at = NOW(),
      deletion_reason = reason
  WHERE id = v_user_id;

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

REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;