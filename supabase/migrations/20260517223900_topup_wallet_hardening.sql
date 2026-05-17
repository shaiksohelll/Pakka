-- ──────────────────────────────────────────────────────────────────────────
-- Hardening for topup_wallet (PR #16 review)
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Replace non-unique partial index with UNIQUE partial index.
--    Rename to follow idx_<table>_<column> convention.
drop index if exists public.escrow_ledger_topup_reference_idx;

create unique index if not exists idx_escrow_ledger_reference_id
  on public.escrow_ledger (reference_id)
  where type = 'topup';

-- 2. job_id may only be null for non-job-scoped ledger types.
alter table public.escrow_ledger
  add constraint escrow_ledger_job_id_required_for_job_types
  check (type in ('topup', 'withdraw') or job_id is not null);

-- 3. Wallet owners can read their own non-job-scoped ledger rows.
--    Additive: stacks via OR with the existing is_job_participant(job_id) policy.
drop policy if exists "escrow_ledger_select_wallet_owner" on public.escrow_ledger;

create policy "escrow_ledger_select_wallet_owner"
  on public.escrow_ledger
  for select
  to authenticated
  using (
    auth.uid() = from_wallet
    or auth.uid() = to_wallet
  );

-- 4. Hardened topup_wallet:
--    - null idempotency key rejected at DB boundary
--    - INSERT ledger row FIRST so the UNIQUE index catches concurrent racers
--    - exception when unique_violation re-reads the winning row
create or replace function public.topup_wallet(
  p_amount numeric,
  p_idempotency_key uuid
)
returns table (available_balance numeric, ledger_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_ledger_id  uuid;
  v_available  numeric;
begin
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 100 or p_amount > 100000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Defends against direct RPC callers bypassing the action-layer Zod check.
  if p_idempotency_key is null then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  -- Ensure wallet row exists.
  insert into public.wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;

  -- Fast path: idempotency hit.
  select id into v_ledger_id
  from public.escrow_ledger
  where reference_id = p_idempotency_key
    and type = 'topup'
  limit 1;

  if found then
    select w.available_balance into v_available
    from public.wallets w
    where w.profile_id = v_profile_id;
    return query select v_available, v_ledger_id;
    return;
  end if;

  -- Write ledger BEFORE crediting. UNIQUE index serializes concurrent calls.
  begin
    insert into public.escrow_ledger (
      job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
    )
    values (
      null, null, null, v_profile_id, p_amount, 'topup', p_idempotency_key
    )
    returning id into v_ledger_id;
  exception when unique_violation then
    -- Concurrent caller won. Re-read the winning row + current balance.
    select id into v_ledger_id
    from public.escrow_ledger
    where reference_id = p_idempotency_key
      and type = 'topup'
    limit 1;
    select w.available_balance into v_available
    from public.wallets w
    where w.profile_id = v_profile_id;
    return query select v_available, v_ledger_id;
    return;
  end;

  -- Credit wallet. We own the ledger row → no double-credit possible.
  update public.wallets
    set available_balance = available_balance + p_amount
    where profile_id = v_profile_id
    returning available_balance into v_available;

  return query select v_available, v_ledger_id;
end;
$$;

grant execute on function public.topup_wallet(numeric, uuid) to authenticated;