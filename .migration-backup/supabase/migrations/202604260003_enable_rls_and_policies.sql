alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.jobs enable row level security;
alter table public.milestones enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.proofs enable row level security;
alter table public.disputes enable row level security;
alter table public.materials enable row level security;
alter table public.job_applications enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
using (id = auth.uid());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists worker_profiles_admin_all on public.worker_profiles;
create policy worker_profiles_admin_all
on public.worker_profiles
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists worker_profiles_self_select on public.worker_profiles;
create policy worker_profiles_self_select
on public.worker_profiles
for select
using (profile_id = auth.uid());

drop policy if exists worker_profiles_self_insert on public.worker_profiles;
create policy worker_profiles_self_insert
on public.worker_profiles
for insert
with check (profile_id = auth.uid());

drop policy if exists worker_profiles_self_update on public.worker_profiles;
create policy worker_profiles_self_update
on public.worker_profiles
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists wallets_admin_all on public.wallets;
create policy wallets_admin_all
on public.wallets
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists wallets_owner_select on public.wallets;
create policy wallets_owner_select
on public.wallets
for select
using (profile_id = auth.uid());

drop policy if exists jobs_admin_all on public.jobs;
create policy jobs_admin_all
on public.jobs
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists jobs_select_client_or_worker_or_open_feed on public.jobs;
create policy jobs_select_client_or_worker_or_open_feed
on public.jobs
for select
using (
  client_id = auth.uid()
  or worker_id = auth.uid()
  or (
    status = 'open'::public.job_status
    and public.is_worker()
  )
);

drop policy if exists jobs_insert_client on public.jobs;
create policy jobs_insert_client
on public.jobs
for insert
with check (client_id = auth.uid() and worker_id is null);

drop policy if exists jobs_update_client_or_assigned_worker on public.jobs;
create policy jobs_update_client_or_assigned_worker
on public.jobs
for update
using (client_id = auth.uid() or worker_id = auth.uid())
with check (client_id = auth.uid() or worker_id = auth.uid());

drop policy if exists jobs_delete_client on public.jobs;
create policy jobs_delete_client
on public.jobs
for delete
using (client_id = auth.uid() and status in ('draft', 'cancelled'));

drop policy if exists milestones_admin_all on public.milestones;
create policy milestones_admin_all
on public.milestones
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists milestones_select_participants on public.milestones;
create policy milestones_select_participants
on public.milestones
for select
using (public.is_job_participant(job_id));

drop policy if exists milestones_insert_client_owner on public.milestones;
create policy milestones_insert_client_owner
on public.milestones
for insert
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = milestones.job_id
      and j.client_id = auth.uid()
  )
);

drop policy if exists milestones_update_client_owner on public.milestones;
create policy milestones_update_client_owner
on public.milestones
for update
using (
  exists (
    select 1
    from public.jobs j
    where j.id = milestones.job_id
      and j.client_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = milestones.job_id
      and j.client_id = auth.uid()
  )
);

drop policy if exists escrow_ledger_admin_all on public.escrow_ledger;
create policy escrow_ledger_admin_all
on public.escrow_ledger
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists escrow_ledger_select_job_participants on public.escrow_ledger;
create policy escrow_ledger_select_job_participants
on public.escrow_ledger
for select
using (public.is_job_participant(job_id));

drop policy if exists escrow_ledger_insert_service_role on public.escrow_ledger;
create policy escrow_ledger_insert_service_role
on public.escrow_ledger
for insert
to service_role
with check (true);

drop policy if exists proofs_admin_all on public.proofs;
create policy proofs_admin_all
on public.proofs
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists proofs_select_participants on public.proofs;
create policy proofs_select_participants
on public.proofs
for select
using (
  exists (
    select 1
    from public.milestones m
    join public.jobs j on j.id = m.job_id
    where m.id = proofs.milestone_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  )
);

drop policy if exists proofs_insert_assigned_worker on public.proofs;
create policy proofs_insert_assigned_worker
on public.proofs
for insert
with check (
  exists (
    select 1
    from public.milestones m
    join public.jobs j on j.id = m.job_id
    where m.id = proofs.milestone_id
      and j.worker_id = auth.uid()
  )
);

drop policy if exists disputes_admin_all on public.disputes;
create policy disputes_admin_all
on public.disputes
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists disputes_select_participants on public.disputes;
create policy disputes_select_participants
on public.disputes
for select
using (public.is_job_participant(job_id));

drop policy if exists disputes_insert_participants on public.disputes;
create policy disputes_insert_participants
on public.disputes
for insert
with check (
  raised_by = auth.uid()
  and public.is_job_participant(job_id)
);

drop policy if exists disputes_update_participants on public.disputes;
create policy disputes_update_participants
on public.disputes
for update
using (public.is_job_participant(job_id))
with check (public.is_job_participant(job_id));

drop policy if exists materials_admin_all on public.materials;
create policy materials_admin_all
on public.materials
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists materials_select_participants on public.materials;
create policy materials_select_participants
on public.materials
for select
using (
  exists (
    select 1
    from public.jobs j
    where j.id = materials.job_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  )
);

drop policy if exists materials_insert_participants on public.materials;
create policy materials_insert_participants
on public.materials
for insert
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = materials.job_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  )
);

drop policy if exists materials_update_participants on public.materials;
create policy materials_update_participants
on public.materials
for update
using (
  exists (
    select 1
    from public.jobs j
    where j.id = materials.job_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = materials.job_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  )
);

drop policy if exists job_applications_admin_all on public.job_applications;
create policy job_applications_admin_all
on public.job_applications
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists job_applications_select_visible_to_owner_or_worker on public.job_applications;
create policy job_applications_select_visible_to_owner_or_worker
on public.job_applications
for select
using (
  worker_id = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and j.client_id = auth.uid()
  )
);

drop policy if exists job_applications_insert_worker_on_open_jobs on public.job_applications;
create policy job_applications_insert_worker_on_open_jobs
on public.job_applications
for insert
with check (
  worker_id = auth.uid()
  and exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and j.status = 'open'::public.job_status
  )
);

drop policy if exists job_applications_update_owner_or_client on public.job_applications;
create policy job_applications_update_owner_or_client
on public.job_applications
for update
using (
  worker_id = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and j.client_id = auth.uid()
  )
)
with check (
  worker_id = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and j.client_id = auth.uid()
  )
);

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all
on public.notifications
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notifications_recipient_select on public.notifications;
create policy notifications_recipient_select
on public.notifications
for select
using (recipient_id = auth.uid());

drop policy if exists notifications_system_insert on public.notifications;
create policy notifications_system_insert
on public.notifications
for insert
to service_role
with check (true);

drop policy if exists notifications_recipient_update on public.notifications;
create policy notifications_recipient_update
on public.notifications
for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());
