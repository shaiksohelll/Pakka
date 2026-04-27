create or replace function public.fund_escrow(p_milestone_id uuid)
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
begin
  select m.job_id, j.client_id, m.amount, m.status
  into v_job_id, v_client_id, v_amount, v_status
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found';
  end if;

  if auth.uid() <> v_client_id and not public.is_admin() then
    raise exception 'Only job client or admin can fund escrow';
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
    p_milestone_id
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

create or replace function public.approve_milestone(p_milestone_id uuid)
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

  if auth.uid() <> v_client_id and not public.is_admin() then
    raise exception 'Only job client or admin can approve milestone';
  end if;

  if v_status not in ('funded', 'submitted', 'approved') then
    raise exception 'Milestone must be funded/submitted/approved';
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

create or replace function public.dispute_milestone(p_milestone_id uuid, p_reason text)
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

  if auth.uid() not in (v_client_id, v_worker_id) and not public.is_admin() then
    raise exception 'Only job participants or admin can raise dispute';
  end if;

  if v_status in ('released', 'refunded') then
    raise exception 'Cannot dispute released/refunded milestone';
  end if;

  update public.milestones
  set status = 'disputed'::public.milestone_status
  where id = p_milestone_id;

  update public.jobs
  set status = 'disputed'::public.job_status
  where id = v_job_id;

  insert into public.disputes (job_id, milestone_id, raised_by, reason, status)
  values (v_job_id, p_milestone_id, coalesce(auth.uid(), v_client_id), p_reason, 'open')
  returning id into v_dispute_id;

  return v_dispute_id;
end;
$$;

create or replace function public.admin_force_release(
  p_milestone_id uuid,
  p_resolution_notes text default null
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
  v_ledger_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admin can force release';
  end if;

  select m.job_id, j.client_id, j.worker_id, m.amount
  into v_job_id, v_client_id, v_worker_id, v_amount
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
    and m.status not in ('released', 'refunded')
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found or already settled';
  end if;

  if v_worker_id is null then
    raise exception 'Job has no assigned worker';
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
    raise exception 'Insufficient locked balance for release';
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

  update public.disputes
  set status = 'resolved_worker'::public.dispute_status,
      resolution_notes = coalesce(p_resolution_notes, resolution_notes),
      resolved_by = auth.uid(),
      resolved_at = now()
  where milestone_id = p_milestone_id
    and status in ('open', 'mediating');

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

  return v_ledger_id;
end;
$$;

create or replace function public.admin_refund(
  p_milestone_id uuid,
  p_resolution_notes text default null
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
  v_ledger_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admin can refund';
  end if;

  select m.job_id, j.client_id, m.amount
  into v_job_id, v_client_id, v_amount
  from public.milestones m
  join public.jobs j on j.id = m.job_id
  where m.id = p_milestone_id
    and m.status not in ('released', 'refunded')
  for update of m, j;

  if v_job_id is null then
    raise exception 'Milestone not found or already settled';
  end if;

  perform 1
  from public.wallets w
  where w.profile_id = v_client_id
  for update;

  if not exists (
    select 1
    from public.wallets w
    where w.profile_id = v_client_id
      and w.locked_balance >= v_amount
  ) then
    raise exception 'Insufficient locked balance for refund';
  end if;

  update public.wallets
  set locked_balance = locked_balance - v_amount,
      available_balance = available_balance + v_amount
  where profile_id = v_client_id;

  update public.milestones
  set status = 'refunded'::public.milestone_status,
      approved_at = now()
  where id = p_milestone_id;

  update public.disputes
  set status = 'resolved_client'::public.dispute_status,
      resolution_notes = coalesce(p_resolution_notes, resolution_notes),
      resolved_by = auth.uid(),
      resolved_at = now()
  where milestone_id = p_milestone_id
    and status in ('open', 'mediating');

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
    'refund'::public.ledger_type,
    p_milestone_id
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

grant execute on function public.fund_escrow(uuid) to authenticated;
grant execute on function public.approve_milestone(uuid) to authenticated;
grant execute on function public.dispute_milestone(uuid, text) to authenticated;
grant execute on function public.admin_force_release(uuid, text) to authenticated;
grant execute on function public.admin_refund(uuid, text) to authenticated;
