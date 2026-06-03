-- Migration: withdraw_wallet RPC
-- Purpose: Worker-initiated wallet withdrawal (test mode — no real payout).
-- Mirrors topup_wallet: look-then-leap idempotency, wallet-update-then-ledger.
-- Bounds: 100 <= amount <= wallet.available_balance.
-- Adds per-user UNIQUE index from day one (lesson from topup hardening 20260518002100).
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
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_min_amount constant numeric := 100;
  v_current_balance numeric;
  v_ledger_id uuid;
  v_new_balance numeric;
begin
  -- 1. Auth check
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 2. Validate amount (minimum ₹100; upper bound enforced against balance below)
  if p_amount is null or p_amount < v_min_amount then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- 3. Idempotency replay: if a withdraw with this key already exists for THIS user,
  --    return current balance + existing ledger id without re-debiting.
  select id into v_ledger_id
  from escrow_ledger
  where reference_id = p_idempotency_key
    and type = 'withdraw'
    and from_wallet = v_profile_id
  limit 1;

  if v_ledger_id is not null then
    select w.available_balance into v_new_balance
    from wallets w
    where w.profile_id = v_profile_id;
    return query select v_new_balance, v_ledger_id;
    return;
  end if;

  -- 4. Read + lock wallet row to serialize concurrent withdraws and prevent overdraft race.
  select available_balance into v_current_balance
  from wallets
  where profile_id = v_profile_id
  for update;

  if v_current_balance is null then
    raise exception 'wallet_not_found' using errcode = '22023';
  end if;

  if p_amount > v_current_balance then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  -- 5. Debit the wallet and capture the new balance
  update wallets
  set available_balance = available_balance - p_amount
  where profile_id = v_profile_id
  returning available_balance into v_new_balance;

  -- 6. Audit row in escrow_ledger
  --    job_id / milestone_id / to_wallet all null (wallet → external)
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

-- Grants
revoke all on function public.withdraw_wallet(numeric, uuid) from public;
grant execute on function public.withdraw_wallet(numeric, uuid) to authenticated;

-- Per-user idempotency: same (from_wallet, reference_id) cannot insert twice for withdraws.
-- Mirrors topup's per-user hardening from 20260518002100; applied from day one for withdraw.
create unique index if not exists idx_escrow_ledger_withdraw_owner_reference
  on public.escrow_ledger (from_wallet, reference_id)
  where type = 'withdraw';