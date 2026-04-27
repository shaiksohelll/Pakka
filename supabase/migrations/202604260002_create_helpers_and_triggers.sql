create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.app_role
  );
$$;

create or replace function public.is_worker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'worker'::public.app_role
  );
$$;

create or replace function public.is_job_participant(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and (j.client_id = auth.uid() or j.worker_id = auth.uid())
  );
$$;

create or replace function public.touch_wallet_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wallets_touch_updated_at on public.wallets;
create trigger trg_wallets_touch_updated_at
before update on public.wallets
for each row
execute function public.touch_wallet_updated_at();

create or replace function public.create_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_profiles_create_wallet on public.profiles;
create trigger trg_profiles_create_wallet
after insert on public.profiles
for each row
execute function public.create_wallet_for_profile();

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_worker() to authenticated, anon;
grant execute on function public.is_job_participant(uuid) to authenticated, anon;
