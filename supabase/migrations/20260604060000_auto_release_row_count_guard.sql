-- ─────────────────────────────────────────────────────────────────────────────
-- Fix F1: Add GET DIAGNOSTICS row_count guards to auto_release_milestones
--
-- The two wallet UPDATEs (client debit, worker credit) lacked row_count
-- verification.  If either wallet row were missing, the UPDATE would silently
-- affect 0 rows and money would vanish.  Every other money-path RPC already
-- has this guard; this migration brings auto_release into line.
--
-- Additionally:
-- (a) The per-milestone EXCEPTION handler now catches SQLSTATE 'P0002'
--     (wallet_not_found) so a missing wallet skips that one milestone and
--     continues the loop, instead of aborting the entire pg_cron batch.
-- (b) The client-wallet check is split: first verify the wallet row exists
--     (route to P0002 if missing), then check locked_balance >= amount
--     (route to the underfunded skip path if insufficient).
--
-- Forward-only: CREATE OR REPLACE over the version from
-- 20260521080000_pr19_review_fixes.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.auto_release_milestones()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_milestone record;
  v_count integer := 0;
  v_rows  integer;
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
    begin
      -- Lock wallets in consistent order to avoid deadlocks.
      perform 1
      from public.wallets w
      where w.profile_id in (v_milestone.client_id, v_milestone.worker_id)
      order by w.profile_id
      for update;
  
      -- Check client wallet exists separately from balance check.
      -- Missing wallet → raise P0002 (caught by EXCEPTION handler, skip milestone).
      -- Insufficient balance → underfunded skip path (NOTICE, continue loop).
      if not exists (
        select 1 from public.wallets w where w.profile_id = v_milestone.client_id
      ) then
        raise exception 'pakka:wallet_not_found: Wallet not found' using errcode = 'P0002';
      end if;

      if exists (
        select 1
        from public.wallets w
        where w.profile_id = v_milestone.client_id
          and w.locked_balance >= v_milestone.amount
      ) then
        -- Debit client locked balance.
        update public.wallets
        set locked_balance = locked_balance - v_milestone.amount
        where profile_id = v_milestone.client_id;
        get diagnostics v_rows = row_count;
        if v_rows <> 1 then
          raise exception 'pakka:wallet_not_found: Wallet not found' using errcode = 'P0002';
        end if;
  
        -- Credit worker available balance.
        update public.wallets
        set available_balance = available_balance + v_milestone.amount
        where profile_id = v_milestone.worker_id;
        get diagnostics v_rows = row_count;
        if v_rows <> 1 then
          raise exception 'pakka:wallet_not_found: Wallet not found' using errcode = 'P0002';
        end if;
  
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
    exception
      when unique_violation then
        raise warning 'auto_release: duplicate release blocked for milestone %', v_milestone.id;
        -- subtransaction rolls back THIS milestone's wallet mutation; loop continues
      when sqlstate 'P0002' then
        raise warning 'pakka:auto_release skipped milestone %: wallet not found', v_milestone.id;
        -- subtransaction rolls back any partial work for THIS milestone; loop continues
    end;
  end loop;

  return v_count;
end;
$$;

-- Preserve existing permission lockdown from 20260603100000_escrow_idempotency.sql L470:
-- auto_release_milestones is only called by pg_cron (as postgres).
revoke execute on function public.auto_release_milestones() from anon, public, authenticated;
