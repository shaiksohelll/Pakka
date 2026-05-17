-- 1. Allow nullable job_id for non-escrow ledger entries (topup, withdraw).
--    The enum already permits these types; the NOT NULL was an oversight.
alter table public.escrow_ledger
  alter column job_id drop not null;

-- 2. RPC: top up the caller's wallet (test mode — no real payment).
create or replace function public.topup_wallet(
  p_amount numeric,
  p_idempotency_key uuid
)
returns table (
  available_balance numeric,
  ledger_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_min_amount constant numeric := 100;
  v_max_amount constant numeric := 100000;
  v_ledger_id uuid;
  v_new_balance numeric;
begin
  -- 1. Auth check
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 2. Validate amount (test-mode bounds: ₹100 – ₹1,00,000)
  if p_amount is null or p_amount < v_min_amount or p_amount > v_max_amount then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- 3. Idempotency: if a topup ledger row with this reference already exists,
  --    return the current balance + existing ledger id without re-crediting.
  select id into v_ledger_id
  from escrow_ledger
  where reference_id = p_idempotency_key
    and type = 'topup'
  limit 1;

  if v_ledger_id is not null then
    select w.available_balance into v_new_balance
    from wallets w
    where w.profile_id = v_profile_id;
    return query select v_new_balance, v_ledger_id;
    return;
  end if;

  -- 4. Defensive: ensure wallet exists (the create_wallet_for_profile trigger
  --    should have already done this, but belt-and-suspenders).
  insert into wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  -- 5. Credit the wallet and capture the new balance
  update wallets
  set available_balance = available_balance + p_amount
  where profile_id = v_profile_id
  returning available_balance into v_new_balance;

  -- 6. Audit row in escrow_ledger
  --    job_id / milestone_id / from_wallet all null (external → wallet)
  insert into escrow_ledger (
    job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
  )
  values (
    null, null, null, v_profile_id, p_amount, 'topup', p_idempotency_key
  )
  returning id into v_ledger_id;

  return query select v_new_balance, v_ledger_id;
end;
$$;

-- 3. Grants
revoke all on function public.topup_wallet(numeric, uuid) from public;
grant execute on function public.topup_wallet(numeric, uuid) to authenticated;

-- 4. Index to keep the idempotency lookup fast
create index if not exists escrow_ledger_topup_reference_idx
  on public.escrow_ledger (reference_id)
  where type = 'topup';