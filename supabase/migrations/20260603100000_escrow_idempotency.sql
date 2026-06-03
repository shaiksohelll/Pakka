-- ─────────────────────────────────────────────────────────────────────────────
-- Wire idempotency keys into the 4 escrow state-machine RPCs.
--
-- 1. Add partial UNIQUE indexes on escrow_ledger for fund/release, and on
--    disputes for open-per-milestone.
-- 2. DROP old function signatures (adding a param creates an overload, not a
--    replacement) and CREATE OR REPLACE with the new (uuid, uuid) / (uuid, text, uuid)
--    signatures.
-- 3. Re-grant execute on the new signatures.
--
-- ADR 0006.
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. Partial unique indexes
-- ============================================================

-- Per-wallet idempotency for fund operations.
-- Mirrors the topup/withdraw pattern from 20260518002100 / 20260518135600.
create unique index if not exists idx_escrow_ledger_fund_owner_reference
  on public.escrow_ledger (to_wallet, reference_id)
  where type = 'fund';

-- Per-wallet idempotency for release operations.
create unique index if not exists idx_escrow_ledger_release_owner_reference
  on public.escrow_ledger (from_wallet, reference_id)
  where type = 'release';

-- At most one open dispute per milestone.
-- Pre-index cleanup: if old dispute_milestone inserted duplicates, keep exactly
-- one open dispute per milestone (earliest by created_at, tie-break by id) and
-- DELETE the rest. Using row_number() handles identical-timestamp ties that the
-- previous min(created_at) approach missed. No FK children reference disputes,
-- so a plain DELETE is safe.
delete from public.disputes
where id in (
  select id from (
    select id, row_number() over (
      partition by milestone_id order by created_at, id
    ) as rn
    from public.disputes
    where status = 'open'
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists idx_disputes_milestone_open
  on public.disputes (milestone_id)
  where status = 'open';

-- ============================================================
-- 2. Drop old function signatures
-- ============================================================
-- These are not called by any other DB function (admin_force_release,
-- admin_refund, auto_release_milestones all mutate status directly).

drop function if exists public.fund_escrow(uuid);
drop function if exists public.submit_milestone(uuid);
drop function if exists public.approve_milestone(uuid);
drop function if exists public.dispute_milestone(uuid, text);

-- ============================================================
-- 3. Recreate with idempotency key parameter
-- ============================================================

-- ── fund_escrow ──────────────────────────────────────────────────────────────
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
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  select m.job_id, j.client_id, m.amount, m.status
  into v_job_id, v_client_id, v_amount, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found';
  end if;

  if auth.uid() is distinct from v_client_id and not public.is_admin() then
    raise exception 'Only job client or admin can fund escrow';
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
      raise exception 'invalid_idempotency_key' using errcode = '22023';
    end if;
  end if;

  if v_status <> 'pending'::public.milestone_status then
    raise exception 'Milestone must be in pending state';
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
    raise exception 'Insufficient available balance';
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

-- ── submit_milestone ─────────────────────────────────────────────────────────
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
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  select m.job_id, j.worker_id, m.status
  into v_job_id, v_worker_id, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found';
  end if;

  if v_worker_id is null then
    raise exception 'Job has no assigned worker';
  end if;

  if auth.uid() is distinct from v_worker_id and not public.is_admin() then
    raise exception 'Only assigned worker or admin can submit milestone';
  end if;

  -- Idempotent: already submitted → return early.
  if v_status = 'submitted'::public.milestone_status then
    return p_milestone_id;
  end if;

  if v_status <> 'funded'::public.milestone_status then
    raise exception 'Milestone must be funded to submit (current: %)', v_status;
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

-- ── approve_milestone ────────────────────────────────────────────────────────
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
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  select m.job_id, j.client_id, j.worker_id, m.amount, m.status
  into v_job_id, v_client_id, v_worker_id, v_amount, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found';
  end if;

  if v_worker_id is null then
    raise exception 'Job has no assigned worker';
  end if;

  if auth.uid() is distinct from v_client_id and not public.is_admin() then
    raise exception 'Only job client or admin can approve milestone';
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
    raise exception 'Milestone must be funded or submitted';
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
    raise exception 'Insufficient locked balance';
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

-- ── dispute_milestone ────────────────────────────────────────────────────────
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
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Reason is required';
  end if;

  select m.job_id, j.client_id, j.worker_id, m.status
  into v_job_id, v_client_id, v_worker_id, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found';
  end if;

  if auth.uid() is distinct from v_client_id and auth.uid() is distinct from v_worker_id and not public.is_admin() then
    raise exception 'Only job participants or admin can raise dispute' using errcode = '42501';
  end if;

  if v_status in ('released', 'refunded') then
    raise exception 'Cannot dispute released/refunded milestone';
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

-- ============================================================
-- 4. Re-grant permissions on new signatures
-- ============================================================

revoke all on function public.fund_escrow(uuid, uuid) from public, anon;
grant execute on function public.fund_escrow(uuid, uuid) to authenticated;

revoke all on function public.submit_milestone(uuid, uuid) from public, anon;
grant execute on function public.submit_milestone(uuid, uuid) to authenticated;

revoke all on function public.approve_milestone(uuid, uuid) from public, anon;
grant execute on function public.approve_milestone(uuid, uuid) to authenticated;

revoke all on function public.dispute_milestone(uuid, text, uuid) from public, anon;
grant execute on function public.dispute_milestone(uuid, text, uuid) to authenticated;

-- N5: auto_release_milestones is only called by pg_cron (as postgres).
-- Revoke from everyone else as defence-in-depth.
revoke execute on function public.auto_release_milestones() from anon, public, authenticated;
