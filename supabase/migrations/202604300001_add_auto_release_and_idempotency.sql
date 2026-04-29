-- 202604300001_add_auto_release_and_idempotency.sql
-- Phase 4 additions:
--   1. auto_release_milestones() — cron-callable function for auto-releasing submitted milestones past 72h
--   2. idempotency_keys table — stores idempotency keys for deduplication
--   3. Notification trigger on milestone status change

-- ============================================================
-- 1. Auto-release function (called by cron)
-- ============================================================
create or replace function public.auto_release_milestones()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone record;
  v_count integer := 0;
begin
  for v_milestone in
    select m.id, m.job_id, j.client_id, j.worker_id, m.amount
    from public.milestones m
    join public.jobs j on j.id = m.job_id
    where m.status = 'submitted'::public.milestone_status
      and m.auto_release_at is not null
      and m.auto_release_at < now()
      and j.worker_id is not null
      -- Ensure no open disputes on this milestone
      and not exists (
        select 1
        from public.disputes d
        where d.milestone_id = m.id
          and d.status in ('open', 'mediating')
      )
    order by m.auto_release_at
    for update of m skip locked
  loop
    -- Lock wallets in consistent order
    perform 1
    from public.wallets w
    where w.profile_id in (v_milestone.client_id, v_milestone.worker_id)
    order by w.profile_id
    for update;

    -- Guard: sufficient locked balance
    if exists (
      select 1
      from public.wallets w
      where w.profile_id = v_milestone.client_id
        and w.locked_balance >= v_milestone.amount
    ) then
      -- Transfer funds
      update public.wallets
      set locked_balance = locked_balance - v_milestone.amount
      where profile_id = v_milestone.client_id;

      update public.wallets
      set available_balance = available_balance + v_milestone.amount
      where profile_id = v_milestone.worker_id;

      -- Update milestone status
      update public.milestones
      set status = 'released'::public.milestone_status,
          approved_at = now()
      where id = v_milestone.id;

      -- Ledger entry
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

      -- Check if all milestones for this job are now done
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

      -- Insert notification for worker
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

      -- Insert notification for client
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

grant execute on function public.auto_release_milestones() to service_role;

-- ============================================================
-- 2. Idempotency keys table
-- ============================================================
create table if not exists public.idempotency_keys (
  key uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_idempotency_keys_user_id on public.idempotency_keys(user_id);
create index if not exists idx_idempotency_keys_created_at on public.idempotency_keys(created_at);

alter table public.idempotency_keys enable row level security;

drop policy if exists idempotency_keys_owner_select on public.idempotency_keys;
create policy idempotency_keys_owner_select
on public.idempotency_keys
for select
using (user_id = auth.uid());

drop policy if exists idempotency_keys_owner_insert on public.idempotency_keys;
create policy idempotency_keys_owner_insert
on public.idempotency_keys
for insert
with check (user_id = auth.uid());

-- ============================================================
-- 3. Milestone status change notification trigger
-- ============================================================
create or replace function public.notify_milestone_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_client_id uuid;
  v_worker_id uuid;
  v_title text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select j.id, j.client_id, j.worker_id
  into v_job_id, v_client_id, v_worker_id
  from public.jobs j
  where j.id = new.job_id;

  select m.title into v_title from public.milestones m where m.id = new.id;

  -- Notify based on new status
  case new.status
    when 'funded' then
      if v_worker_id is not null then
        insert into public.notifications (recipient_id, type, title, body, data)
        values (
          v_worker_id,
          'milestone_funded',
          'Milestone Funded',
          format('Client has funded "%s". Start working!', v_title),
          jsonb_build_object('job_id', v_job_id, 'milestone_id', new.id)
        );
      end if;
    when 'submitted' then
      if v_client_id is not null then
        insert into public.notifications (recipient_id, type, title, body, data)
        values (
          v_client_id,
          'milestone_submitted',
          'Milestone Submitted',
          format('Worker has submitted "%s" for review.', v_title),
          jsonb_build_object('job_id', v_job_id, 'milestone_id', new.id)
        );
      end if;
    when 'released' then
      if v_worker_id is not null then
        insert into public.notifications (recipient_id, type, title, body, data)
        values (
          v_worker_id,
          'milestone_released',
          'Payment Released',
          format('Payment for "%s" has been released to your wallet.', v_title),
          jsonb_build_object('job_id', v_job_id, 'milestone_id', new.id)
        );
      end if;
    when 'disputed' then
      if v_worker_id is not null then
        insert into public.notifications (recipient_id, type, title, body, data)
        values (
          v_worker_id,
          'milestone_disputed',
          'Milestone Disputed',
          format('"%s" has been disputed. Our team will review.', v_title),
          jsonb_build_object('job_id', v_job_id, 'milestone_id', new.id)
        );
      end if;
    else
      null; -- No notification for other states
  end case;

  -- TODO: Phase 6 — invoke Edge Function 'send-push' for Web Push

  return new;
end;
$$;

drop trigger if exists trg_milestone_status_notify on public.milestones;
create trigger trg_milestone_status_notify
after update on public.milestones
for each row
execute function public.notify_milestone_status_change();
