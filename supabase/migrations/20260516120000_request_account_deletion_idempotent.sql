-- Make request_account_deletion idempotent.
-- First call marks profile + notifies admins.
-- Subsequent calls return silently (no profile re-stamp, no notification spam).
-- Also raises if the caller has no profile row at all.

CREATE OR REPLACE FUNCTION public.request_account_deletion(reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (deletion_requested_at IS NOT NULL)
    INTO v_already
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_already IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  IF v_already THEN
    RETURN; -- already requested; no-op
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