-- ─────────────────────────────────────────────────────────────────────────────
-- PR #19 review fixes
--
-- A — Worker-only check in withdraw_wallet RPC
-- C — NULL-guard on p_idempotency_key
-- D — Insert-first / catch unique_violation idempotency (mirrors topup_wallet)
-- F — NULL-guard on p_amount
-- I — public. schema qualifiers
-- E — DROP pakka.allow_milestone_status_change GUC entirely (was settable by any
--     authenticated role via SET/set_config, bypassing the guards).
--     Both guard_milestones_status and guard_jobs_status now allow status changes
--     only when: (a) called from a SECURITY DEFINER function
--     (current_user <> session_user), OR (b) running under the postgres superuser
--     (session_user = 'postgres' AND current_user = 'postgres', i.e. pg_cron
--     context), OR (c) called by an admin (public.is_admin()).
-- H — RAISE NOTICE when auto_release_milestones skips a milestone for
--     insufficient locked balance (visibility into silent skips)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. withdraw_wallet — full rewrite with all fixes
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
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Role: worker accounts only
  if not public.is_worker() then
    raise exception 'forbidden_role' using errcode = '42501';
  end if;

  -- Amount bounds (NULL-safe)
  if p_amount is null or p_amount < 100 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Idempotency key required (NULL keys would bypass the UNIQUE index)
  if p_idempotency_key is null then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
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
    raise exception 'wallet_not_found' using errcode = '22023';
  end if;

  if p_amount > v_available then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  -- Debit wallet.
  update public.wallets w
  set available_balance = w.available_balance - p_amount
  where w.profile_id = v_profile_id
  returning w.available_balance into v_available;

  return query select v_available, v_ledger_id;
end;
$$;

-- 2. guard_milestones_status — drop GUC bypass, gate pg_cron context by explicit role check
create or replace function public.guard_milestones_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status
    and current_user is not distinct from session_user
    and not (session_user = 'postgres' and current_user = 'postgres')
    and not public.is_admin() then
    raise exception 'milestones.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

-- 3. guard_jobs_status — same treatment
create or replace function public.guard_jobs_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status
    and current_user is not distinct from session_user
    and not (session_user = 'postgres' and current_user = 'postgres')
    and not public.is_admin() then
    raise exception 'jobs.status can only change via SECURITY DEFINER function or admin';
  end if;
  return new;
end;
$$;

-- 4. auto_release_milestones — remove GUC setter, add NOTICE on skip
-- See docs/adr/0005-auto-release-milestones-modification.md for the ADR approving this in-place modification.
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
    else
      -- Visibility: log skips so persistent under-funded milestones are diagnosable
      -- via Postgres logs. A future PR can persist these to a dedicated table.
      raise notice 'auto_release_milestones: skipping milestone % (job %): insufficient locked balance for amount %',
        v_milestone.id, v_milestone.job_id, v_milestone.amount;
    end if;
  end loop;

  return v_count;
end;
$$;
-- Server-action pre-check in withdrawWalletAction calls this RPC directly.
grant execute on function public.is_worker() to authenticated;