-- ──────────────────────────────────────────────────────────────────────────
-- Scope top-up idempotency to the recipient wallet (PR #16 codeant re-review)
--
-- The previous UNIQUE index and function lookups keyed on reference_id only,
-- meaning a UUID collision across two different users could suppress one of
-- their top-ups. v4 UUIDs make this statistically impossible, but the bot is
-- right that the data model should enforce per-user scoping as defense in
-- depth. Both the unique constraint and the function's two lookup paths now
-- include the recipient wallet (to_wallet = auth.uid()).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Replace global unique index with per-recipient unique index.
drop index if exists public.idx_escrow_ledger_reference_id;

create unique index if not exists idx_escrow_ledger_topup_owner_reference
  on public.escrow_ledger (to_wallet, reference_id)
  where type = 'topup';

-- 2. Update topup_wallet to include caller-ownership predicate in both
--    idempotency lookups (pre-check + unique_violation recovery).
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

  if p_idempotency_key is null then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  insert into public.wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;

  -- Fast path: idempotency hit, scoped to the calling wallet.
  select id into v_ledger_id
  from public.escrow_ledger
  where reference_id = p_idempotency_key
    and type = 'topup'
    and to_wallet = v_profile_id
  limit 1;

  if found then
    select w.available_balance into v_available
    from public.wallets w
    where w.profile_id = v_profile_id;
    return query select v_available, v_ledger_id;
    return;
  end if;

  -- INSERT first; per-recipient UNIQUE index serializes concurrent calls.
  begin
    insert into public.escrow_ledger (
      job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
    )
    values (
      null, null, null, v_profile_id, p_amount, 'topup', p_idempotency_key
    )
    returning id into v_ledger_id;
  exception when unique_violation then
    -- Re-read the winning row, scoped to the calling wallet.
    select id into v_ledger_id
    from public.escrow_ledger
    where reference_id = p_idempotency_key
      and type = 'topup'
      and to_wallet = v_profile_id
    limit 1;
    select w.available_balance into v_available
    from public.wallets w
    where w.profile_id = v_profile_id;
    return query select v_available, v_ledger_id;
    return;
  end;

  update public.wallets
    set available_balance = available_balance + p_amount
    where profile_id = v_profile_id
    returning available_balance into v_available;

  return query select v_available, v_ledger_id;
end;
$$;

grant execute on function public.topup_wallet(numeric, uuid) to authenticated;