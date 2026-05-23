-- ─────────────────────────────────────────────────────────────────────────────
-- Schedule daily auto-release of milestones past their 72h auto_release_at.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Why this migration is more involved than just `cron.schedule(...)`:
--
-- guard_milestones_status and guard_jobs_status block status changes unless
-- the call is via a "real" SECURITY DEFINER context (current_user ≠
-- session_user) or the caller is admin. Neither holds when pg_cron triggers
-- auto_release_milestones(): both session_user and current_user are
-- `postgres`, and there's no auth.uid().
--
-- Reassigning the function to supabase_admin or service_role is blocked in
-- managed Supabase (postgres lacks SET ROLE on supabase_admin; service_role
-- lacks CREATE on public so can't own objects there).
--
-- Clean fix: extend both guards with a third permissive condition — a session
-- GUC `pakka.allow_milestone_status_change`. Existing escape hatches (role
-- split + is_admin) are preserved, so submit_milestone, admin_force_release,
-- and any other status-changers continue to work unchanged. Only
-- auto_release_milestones needs the new GUC setter.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Teach guard_milestones_status about the sanctioned-bypass GUC.
create or replace function public.guard_milestones_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status
    and current_user is not distinct from session_user
    and not coalesce(current_setting('pakka.allow_milestone_status_change', true)::boolean, false)
    and not public.is_admin() then
    raise exception 'milestones.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

-- 2. Same treatment for guard_jobs_status (uses the same GUC name —
--    auto_release_milestones updates both tables in one transaction).
create or replace function public.guard_jobs_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status
    and current_user is not distinct from session_user
    and not coalesce(current_setting('pakka.allow_milestone_status_change', true)::boolean, false)
    and not public.is_admin() then
    raise exception 'jobs.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

-- 3. Add the GUC setter at the top of auto_release_milestones. Body is
--    otherwise identical to the existing implementation.
--    `true` for the is_local arg → setting is transaction-local, auto-resets.
create or replace function public.auto_release_milestones()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_milestone record;
  v_count integer := 0;
begin
  -- Sanction this transaction's status updates for the guard triggers.
  perform set_config('pakka.allow_milestone_status_change', 'on', true);

  for v_milestone in
    select m.id, m.job_id, j.client_id, j.worker_id, m.amount
    from public.milestones m
    join public.jobs j on j.id = m.job_id
    where m.status = 'submitted'::public.milestone_status
      and m.auto_release_at is not null
      and m.auto_release_at < now()
      and j.worker_id is not null
      and not exists (
        select 1
        from public.disputes d
        where d.milestone_id = m.id
          and d.status in ('open', 'mediating')
      )
    order by m.auto_release_at
    for update of m skip locked
  loop
    -- Lock wallets in consistent order to avoid deadlocks.
    perform 1
    from public.wallets w
    where w.profile_id in (v_milestone.client_id, v_milestone.worker_id)
    order by w.profile_id
    for update;

    if exists (
      select 1
      from public.wallets w
      where w.profile_id = v_milestone.client_id
        and w.locked_balance >= v_milestone.amount
    ) then
      update public.wallets
      set locked_balance = locked_balance - v_milestone.amount
      where profile_id = v_milestone.client_id;

      update public.wallets
      set available_balance = available_balance + v_milestone.amount
      where profile_id = v_milestone.worker_id;

      update public.milestones
      set status = 'released'::public.milestone_status,
          approved_at = now()
      where id = v_milestone.id;

      insert into public.escrow_ledger (
        job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id
      ) values (
        v_milestone.job_id,
        v_milestone.id,
        v_milestone.client_id,
        v_milestone.worker_id,
        v_milestone.amount,
        'release'::public.ledger_type,
        v_milestone.id
      );

      if not exists (
        select 1
        from public.milestones m2
        where m2.job_id = v_milestone.job_id
          and m2.status not in ('released', 'refunded')
      ) then
        update public.jobs
        set status = 'completed'::public.job_status
        where id = v_milestone.job_id;
      end if;

      insert into public.notifications (recipient_id, type, title, body, data)
      values (
        v_milestone.worker_id,
        'milestone_auto_released',
        'Milestone Auto-Released',
        'Your milestone payment has been automatically released.',
        jsonb_build_object(
          'job_id', v_milestone.job_id,
          'milestone_id', v_milestone.id,
          'amount', v_milestone.amount
        )
      );

      insert into public.notifications (recipient_id, type, title, body, data)
      values (
        v_milestone.client_id,
        'milestone_auto_released',
        'Milestone Auto-Released',
        'A milestone payment was automatically released after 72 hours.',
        jsonb_build_object(
          'job_id', v_milestone.job_id,
          'milestone_id', v_milestone.id,
          'amount', v_milestone.amount
        )
      );

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- 4. Enable pg_cron (no-op if already enabled).
create extension if not exists pg_cron with schema extensions;

-- 5. Schedule daily at 20:30 UTC (= 02:00 IST). Idempotent on re-run.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-release-milestones-daily') then
    perform cron.unschedule('auto-release-milestones-daily');
  end if;

  perform cron.schedule(
    'auto-release-milestones-daily',
    '30 20 * * *',
    $cmd$ select public.auto_release_milestones(); $cmd$
  );
end $$;