-- Fix: column reference "available_balance" was ambiguous inside withdraw_wallet.
-- The function declares RETURNS TABLE (available_balance numeric, ledger_id uuid),
-- which creates an implicit OUT variable that shadows wallets.available_balance.
-- All wallets/escrow_ledger references in the body are now table-aliased.
--
-- ⚠ Superseded by 20260521080000_pr19_review_fixes.sql (final version).
-- This migration still runs for schema history; the later CREATE OR REPLACE wins.

create or replace function public.withdraw_wallet(
  p_amount numeric,
  p_idempotency_key uuid
)
returns table (
  available_balance numeric,
  ledger_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_ledger_id uuid;
begin
  -- 1. Auth
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 2. Bounds
  if p_amount is null or p_amount < 100 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- 3. Idempotency replay (per-user)
  select el.id into v_ledger_id
  from escrow_ledger el
  where el.reference_id = p_idempotency_key
    and el.type = 'withdraw'
    and el.from_wallet = v_profile_id
  limit 1;

  if v_ledger_id is not null then
    select w.available_balance into v_new_balance
    from wallets w
    where w.profile_id = v_profile_id;

    return query select v_new_balance, v_ledger_id;
    return;
  end if;

  -- 4. Read + lock wallet
  select w.available_balance into v_current_balance
  from wallets w
  where w.profile_id = v_profile_id
  for update;

  if v_current_balance is null then
    raise exception 'wallet_not_found' using errcode = '22023';
  end if;

  -- 5. Sufficiency check
  if p_amount > v_current_balance then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  -- 6. Debit + read new balance
  update wallets w
  set available_balance = w.available_balance - p_amount
  where w.profile_id = v_profile_id
  returning w.available_balance into v_new_balance;

  -- 7. Ledger entry
  insert into escrow_ledger (
    job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
  )
  values (
    null, null, v_profile_id, null, p_amount, 'withdraw', p_idempotency_key
  )
  returning id into v_ledger_id;

  return query select v_new_balance, v_ledger_id;
end;
$$;

grant execute on function public.withdraw_wallet(numeric, uuid) to authenticated;