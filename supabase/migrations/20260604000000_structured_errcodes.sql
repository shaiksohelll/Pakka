-- ─────────────────────────────────────────────────────────────────────────────
-- Structured Error Codes and Tokens
-- ADR 0009
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fund_escrow(
  p_milestone_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_client_id uuid;
  v_amount numeric(14, 2);
  v_status public.milestone_status;
  v_ledger_id uuid;
  v_existing_milestone_id uuid;
begin
  -- Reject NULL idempotency keys (NULLs bypass the UNIQUE index)
  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
  end if;

  select m.job_id, j.client_id, m.amount, m.status
  into v_job_id, v_client_id, v_amount, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'pakka:milestone_not_found: Milestone not found' using errcode = 'P0002';
  end if;

  if auth.uid() is distinct from v_client_id and not public.is_admin() then
    raise exception 'pakka:not_authorized: Only job client or admin can fund escrow' using errcode = '42501';
  end if;

  -- Idempotency: if a ledger row with this key already exists, return it,
  -- provided it's for the same milestone.
  select el.id, el.milestone_id into v_ledger_id, v_existing_milestone_id
  from public.escrow_ledger el
  where el.reference_id = p_idempotency_key
    and el.type = 'fund'
    and el.to_wallet = v_client_id;
  
  if found then
    if v_existing_milestone_id = p_milestone_id then
      return v_ledger_id;
    else
      raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
    end if;
  end if;

  if v_status <> 'pending'::public.milestone_status then
    raise exception 'pakka:invalid_status_transition: Milestone must be in pending state' using errcode = 'P0001';
  end if;

  perform 1
  from public.wallets w
  where w.profile_id = v_client_id
  for update;

  if not exists (
    select 1
    from public.wallets w
    where w.profile_id = v_client_id
      and w.available_balance >= v_amount
  ) then
    raise exception 'pakka:insufficient_balance: Insufficient available balance' using errcode = 'P0001';
  end if;

  update public.wallets
  set available_balance = available_balance - v_amount,
      locked_balance = locked_balance + v_amount
  where profile_id = v_client_id;

  update public.milestones
  set status = 'funded'::public.milestone_status,
      auto_release_at = coalesce(auto_release_at, now() + interval '72 hours')
  where id = p_milestone_id;

  -- fund_escrow mutates the wallet before this INSERT; the unique index is a fail-safe — 
  -- a duplicate must roll back the whole txn (undoing the balance change), not be swallowed. 
  -- Concurrency is serialized by milestone FOR UPDATE + the pending-only status guard.
  insert into public.escrow_ledger (
    job_id,
    milestone_id,
    from_wallet,
    to_wallet,
    amount,
    type,
    reference_id
  )
  values (
    v_job_id,
    p_milestone_id,
    v_client_id,
    v_client_id,
    v_amount,
    'fund'::public.ledger_type,
    p_idempotency_key
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

create or replace function public.submit_milestone(
  p_milestone_id uuid,
  p_idempotency_key uuid -- validated for API-signature consistency; NOT the dedup anchor (status guard / milestone_id drive idempotency)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_worker_id uuid;
  v_status public.milestone_status;
begin
  -- p_idempotency_key is accepted for API-signature consistency with the other
  -- escrow RPCs; the actual idempotency guard for submit relies on milestone
  -- status (early-return when already 'submitted'). We still reject NULL to
  -- enforce the client contract.
  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
  end if;

  select m.job_id, j.worker_id, m.status
  into v_job_id, v_worker_id, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'pakka:milestone_not_found: Milestone not found' using errcode = 'P0002';
  end if;

  if v_worker_id is null then
    raise exception 'pakka:worker_not_assigned: Job has no assigned worker' using errcode = 'P0001';
  end if;

  if auth.uid() is distinct from v_worker_id and not public.is_admin() then
    raise exception 'pakka:not_authorized: Only assigned worker or admin can submit milestone' using errcode = '42501';
  end if;

  -- Idempotent: already submitted → return early.
  if v_status = 'submitted'::public.milestone_status then
    return p_milestone_id;
  end if;

  if v_status <> 'funded'::public.milestone_status then
    raise exception 'pakka:invalid_status_transition: Milestone must be funded to submit (current: %)', v_status using errcode = 'P0001';
  end if;

  update public.milestones
  set status = 'submitted'::public.milestone_status,
      submitted_at = now(),
      auto_release_at = coalesce(auto_release_at, now() + interval '72 hours')
  where id = p_milestone_id;

  -- bump parent job to in_progress if still 'assigned'
  update public.jobs
  set status = 'in_progress'::public.job_status
  where id = v_job_id
    and status = 'assigned'::public.job_status;

  return p_milestone_id;
end;
$$;

create or replace function public.approve_milestone(
  p_milestone_id uuid,
  p_idempotency_key uuid -- validated for API-signature consistency; NOT the dedup anchor (status guard / milestone_id drive idempotency)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_client_id uuid;
  v_worker_id uuid;
  v_amount numeric(14, 2);
  v_status public.milestone_status;
  v_ledger_id uuid;
begin
  -- Reject NULL idempotency keys (NULLs bypass the UNIQUE index)
  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
  end if;

  select m.job_id, j.client_id, j.worker_id, m.amount, m.status
  into v_job_id, v_client_id, v_worker_id, v_amount, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'pakka:milestone_not_found: Milestone not found' using errcode = 'P0002';
  end if;

  if v_worker_id is null then
    raise exception 'pakka:worker_not_assigned: Job has no assigned worker' using errcode = 'P0001';
  end if;

  if auth.uid() is distinct from v_client_id and not public.is_admin() then
    raise exception 'pakka:not_authorized: Only job client or admin can approve milestone' using errcode = '42501';
  end if;

  -- Idempotency: keyed on (from_wallet, milestone_id) via the partial UNIQUE
  -- index idx_escrow_ledger_release_owner_reference. Uses p_milestone_id (not
  -- the user-supplied idempotency key) so both approve_milestone and
  -- auto_release_milestones share one key per milestone → at most one release
  -- ledger row can ever exist.
  select el.id into v_ledger_id
  from public.escrow_ledger el
  where el.reference_id = p_milestone_id
    and el.type = 'release'
    and el.from_wallet = v_client_id;
  if found then
    return v_ledger_id;
  end if;

  -- Guard: removed dead 'approved' value (nothing ever sets it).
  if v_status not in ('funded', 'submitted') then
    raise exception 'pakka:invalid_status_transition: Milestone must be funded or submitted' using errcode = 'P0001';
  end if;

  perform 1
  from public.wallets w
  where w.profile_id in (v_client_id, v_worker_id)
  order by w.profile_id
  for update;

  if not exists (
    select 1
    from public.wallets w
    where w.profile_id = v_client_id
      and w.locked_balance >= v_amount
  ) then
    raise exception 'pakka:insufficient_balance: Insufficient locked balance' using errcode = 'P0001';
  end if;

  update public.wallets
  set locked_balance = locked_balance - v_amount
  where profile_id = v_client_id;

  update public.wallets
  set available_balance = available_balance + v_amount
  where profile_id = v_worker_id;

  update public.milestones
  set status = 'released'::public.milestone_status,
      approved_at = now()
  where id = p_milestone_id;

  -- Hard unique constraint is the fail-safe: money is mutated before this INSERT, 
  -- so a duplicate MUST roll back the whole txn (undoing the release), not be swallowed. 
  -- Concurrency is serialized by FOR UPDATE + the funded/submitted status guard, 
  -- making a conflict unreachable in correct execution.
  insert into public.escrow_ledger (
    job_id,
    milestone_id,
    from_wallet,
    to_wallet,
    amount,
    type,
    reference_id
  )
  values (
    v_job_id,
    p_milestone_id,
    v_client_id,
    v_worker_id,
    v_amount,
    'release'::public.ledger_type,
    p_milestone_id
  )
  returning id into v_ledger_id;

  if not exists (
    select 1
    from public.milestones m
    where m.job_id = v_job_id
      and m.status not in ('released', 'refunded')
  ) then
    update public.jobs
    set status = 'completed'::public.job_status
    where id = v_job_id;
  end if;

  return v_ledger_id;
end;
$$;

create or replace function public.dispute_milestone(
  p_milestone_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_client_id uuid;
  v_worker_id uuid;
  v_status public.milestone_status;
  v_dispute_id uuid;
begin
  -- Reject NULL idempotency keys (enforces client contract)
  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'pakka:reason_required: Reason is required' using errcode = '22023';
  end if;

  select m.job_id, j.client_id, j.worker_id, m.status
  into v_job_id, v_client_id, v_worker_id, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'pakka:milestone_not_found: Milestone not found' using errcode = 'P0002';
  end if;

  if auth.uid() is distinct from v_client_id and auth.uid() is distinct from v_worker_id and not public.is_admin() then
    raise exception 'pakka:not_authorized: Only job participants or admin can raise dispute' using errcode = '42501';
  end if;

  if v_status in ('released', 'refunded') then
    raise exception 'pakka:cannot_dispute_settled: Cannot dispute released/refunded milestone' using errcode = 'P0001';
  end if;

  -- Idempotency: if an open dispute already exists for this milestone, return it.
  select d.id into v_dispute_id
  from public.disputes d
  where d.milestone_id = p_milestone_id
    and d.status = 'open';
  if found then
    return v_dispute_id;
  end if;

  update public.milestones
  set status = 'disputed'::public.milestone_status
  where id = p_milestone_id;

  update public.jobs
  set status = 'disputed'::public.job_status
  where id = v_job_id;

  -- Insert with unique_violation guard (races against the partial unique index).
  -- Safe here because no money has moved — only status changes, which are
  -- idempotent (disputed → disputed is a no-op).
  begin
    insert into public.disputes (job_id, milestone_id, raised_by, reason, status)
    values (v_job_id, p_milestone_id, coalesce(auth.uid(), v_client_id), p_reason, 'open')
    returning id into v_dispute_id;
  exception when unique_violation then
    -- Race-loser: another concurrent call already inserted the dispute row.
    select d.id into v_dispute_id
    from public.disputes d
    where d.milestone_id = p_milestone_id
      and d.status = 'open';
  end;

  return v_dispute_id;
end;
$$;

create or replace function public.withdraw_wallet(
  p_amount numeric,
  p_idempotency_key uuid
)
returns table(available_balance numeric, ledger_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile_id uuid := auth.uid();
  v_ledger_id  uuid;
  v_available  numeric;
begin
  -- Auth
  if v_profile_id is null then
    raise exception 'pakka:not_authenticated: Not authenticated' using errcode = '42501';
  end if;

  -- Role: worker accounts only
  if not public.is_worker() then
    raise exception 'pakka:forbidden_role: Withdrawals are restricted to worker accounts' using errcode = '42501';
  end if;

  -- Amount bounds (NULL-safe)
  if p_amount is null or p_amount < 100 then
    raise exception 'pakka:invalid_amount: Invalid transaction amount' using errcode = '22023';
  end if;
  if p_amount > 500000 then
    raise exception 'pakka:invalid_amount: Invalid transaction amount' using errcode = '22023';
  end if;

  -- Idempotency key required (NULL keys would bypass the UNIQUE index)
  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
  end if;

  -- INSERT ledger first; per-sender UNIQUE index serializes concurrent duplicate-key
  -- calls at the INSERT itself. Race-losers get unique_violation → replay path.
  -- Nested block scopes the handler to ONLY this INSERT so that any future
  -- UNIQUE violation elsewhere in the function is not misclassified as a replay.
  begin
    insert into public.escrow_ledger (
      job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
    )
    values (
      null, null, v_profile_id, null, p_amount, 'withdraw', p_idempotency_key
    )
    returning id into v_ledger_id;
  exception
    when unique_violation then
      -- Race-loser replay: the winning concurrent call already inserted the ledger row
      -- and debited the wallet. Re-read the winning ledger id, scoped to the calling wallet.
      select el.id into v_ledger_id
      from public.escrow_ledger el
      where el.reference_id = p_idempotency_key
        and el.type = 'withdraw'
        and el.from_wallet = v_profile_id
      limit 1;
      -- Return the current post-debit balance.
      select w.available_balance into v_available
      from public.wallets w
      where w.profile_id = v_profile_id;
      return query select v_available, v_ledger_id;
      return;
  end;

  -- Lock wallet row for atomic debit (now that we own the ledger slot).
  select w.available_balance into v_available
  from public.wallets w
  where w.profile_id = v_profile_id
  for update;

  if v_available is null then
    raise exception 'pakka:wallet_not_found: Wallet not found' using errcode = 'P0002';
  end if;

  if p_amount > v_available then
    raise exception 'pakka:insufficient_balance: Insufficient balance' using errcode = 'P0001';
  end if;

  -- Debit wallet.
  update public.wallets w
  set available_balance = w.available_balance - p_amount
  where w.profile_id = v_profile_id
  returning w.available_balance into v_available;

  return query select v_available, v_ledger_id;
end;
$$;

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
    raise exception 'pakka:not_authenticated: Not authenticated' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 100 or p_amount > 100000 then
    raise exception 'pakka:invalid_amount: Invalid transaction amount' using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'pakka:invalid_idempotency_key: Request signature missing' using errcode = '22023';
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
