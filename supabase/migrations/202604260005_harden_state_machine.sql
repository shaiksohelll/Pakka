-- 202604260005_harden_state_machine.sql
-- Closes holes flagged during file-by-file audit:
--   1. submit_milestone() — fills missing worker funded→submitted transition
--   2. Locks worker self-elevation columns (kyc_status, trust_tier, rating, jobs_completed)
--   3. Locks status columns on jobs/milestones/disputes (admin or SECURITY DEFINER only)
--   4. admin_approve_kyc / admin_reject_kyc RPCs

-- ============================================================
-- 1. submit_milestone(): worker uploads proof → funded → submitted
-- ============================================================
create or replace function public.submit_milestone(p_milestone_id uuid)
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

  if auth.uid() <> v_worker_id and not public.is_admin() then
    raise exception 'Only assigned worker or admin can submit milestone';
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

grant execute on function public.submit_milestone(uuid) to authenticated;

-- ============================================================
-- 2. Lock worker self-elevation columns
-- ============================================================
create or replace function public.guard_worker_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins can change anything
  if public.is_admin() then
    return new;
  end if;

  -- SECURITY DEFINER context (current_user differs from session_user) is allowed
  if current_user is distinct from session_user then
    return new;
  end if;

  if new.kyc_status is distinct from old.kyc_status then
    raise exception 'kyc_status can only be updated by admin (use admin_approve_kyc / admin_reject_kyc)';
  end if;
  if new.trust_tier is distinct from old.trust_tier then
    raise exception 'trust_tier can only be updated by admin';
  end if;
  if new.rating is distinct from old.rating then
    raise exception 'rating is system-managed';
  end if;
  if new.jobs_completed is distinct from old.jobs_completed then
    raise exception 'jobs_completed is system-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_worker_profile_columns on public.worker_profiles;
create trigger guard_worker_profile_columns
before update on public.worker_profiles
for each row
execute function public.guard_worker_profile_columns();

-- ============================================================
-- 3. Lock status columns on jobs / milestones / disputes
-- ============================================================
-- Pattern: SECURITY DEFINER functions run with current_user = function owner
-- (postgres) while session_user remains 'authenticated'. Direct UPDATE from
-- the API has current_user = session_user. We use that to gate.

create or replace function public.guard_jobs_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_user is not distinct from session_user
     and not public.is_admin() then
    raise exception 'jobs.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_jobs_status on public.jobs;
create trigger guard_jobs_status
before update on public.jobs
for each row
execute function public.guard_jobs_status();

create or replace function public.guard_milestones_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_user is not distinct from session_user
     and not public.is_admin() then
    raise exception 'milestones.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_milestones_status on public.milestones;
create trigger guard_milestones_status
before update on public.milestones
for each row
execute function public.guard_milestones_status();

create or replace function public.guard_disputes_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_user is not distinct from session_user
     and not public.is_admin() then
    raise exception 'disputes.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_disputes_status on public.disputes;
create trigger guard_disputes_status
before update on public.disputes
for each row
execute function public.guard_disputes_status();

-- ============================================================
-- 4. Admin KYC review RPCs
-- ============================================================
create or replace function public.admin_approve_kyc(
  p_profile_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can approve KYC';
  end if;

  update public.worker_profiles
  set kyc_status = 'verified'::public.kyc_status
  where profile_id = p_profile_id;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  return p_profile_id;
end;
$$;

create or replace function public.admin_reject_kyc(
  p_profile_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can reject KYC';
  end if;

  update public.worker_profiles
  set kyc_status = 'rejected'::public.kyc_status
  where profile_id = p_profile_id;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  return p_profile_id;
end;
$$;

grant execute on function public.admin_approve_kyc(uuid, text) to authenticated;
grant execute on function public.admin_reject_kyc(uuid, text) to authenticated;