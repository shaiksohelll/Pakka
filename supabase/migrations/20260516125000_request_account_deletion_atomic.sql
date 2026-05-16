-- Make request_account_deletion atomically idempotent.
-- Replaces the previous SELECT-then-UPDATE guard which had a TOCTOU race
-- under concurrent calls (e.g. double-tap on mobile, retry loops).
-- The atomic UPDATE-WHERE-IS-NULL-RETURNING ensures only one caller wins;
-- losers fall through to a silent no-op.

CREATE OR REPLACE FUNCTION public.request_account_deletion(reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_changed_id uuid;
  v_profile_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Atomic gate: only the first concurrent caller observes IS NULL and wins.
  UPDATE public.profiles
  SET deletion_requested_at = NOW(),
      deletion_reason = reason
  WHERE id = v_user_id
    AND deletion_requested_at IS NULL
  RETURNING id INTO v_changed_id;

  IF v_changed_id IS NOT NULL THEN
    -- We won; notify admins exactly once.
    INSERT INTO public.notifications (recipient_id, type, title, body, data)
    SELECT id,
           'account_deletion_requested',
           'Account deletion requested',
           COALESCE('Reason: ' || reason, 'No reason given'),
           jsonb_build_object('user_id', v_user_id, 'reason', reason)
    FROM public.profiles
    WHERE role = 'admin';
    RETURN;
  END IF;

  -- UPDATE matched 0 rows. Either profile missing or already requested.
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id)
    INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  -- Already requested by an earlier (or concurrent winner) call. No-op.
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;