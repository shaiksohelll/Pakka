create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('client', 'worker', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'kyc_status') then
    create type public.kyc_status as enum ('pending', 'verified', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'trust_tier') then
    create type public.trust_tier as enum ('bronze', 'silver', 'gold');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'draft',
      'open',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
      'disputed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'milestone_status') then
    create type public.milestone_status as enum (
      'pending',
      'funded',
      'submitted',
      'approved',
      'disputed',
      'released',
      'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ledger_type') then
    create type public.ledger_type as enum ('fund', 'release', 'refund', 'topup', 'withdraw');
  end if;

  if not exists (select 1 from pg_type where typname = 'proof_type') then
    create type public.proof_type as enum ('photo', 'video');
  end if;

  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type public.dispute_status as enum (
      'open',
      'mediating',
      'resolved_client',
      'resolved_worker',
      'split'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'material_status') then
    create type public.material_status as enum ('requested', 'paid', 'delivered');
  end if;

  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum (
      'pending',
      'shortlisted',
      'accepted',
      'rejected',
      'withdrawn'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text not null,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  kyc_status public.kyc_status not null default 'pending',
  aadhaar_last4 char(4),
  pan_last4 char(4),
  selfie_url text,
  categories text[] not null default '{}',
  skill_tags text[] not null default '{}',
  trust_tier public.trust_tier not null default 'bronze',
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  jobs_completed integer not null default 0 check (jobs_completed >= 0),
  created_at timestamptz not null default now(),
  constraint aadhaar_last4_digits check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  constraint pan_last4_alnum check (pan_last4 is null or pan_last4 ~ '^[A-Z0-9]{4}$')
);

create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  locked_balance numeric(14, 2) not null default 0 check (locked_balance >= 0),
  available_balance numeric(14, 2) not null default 0 check (available_balance >= 0),
  currency text not null default 'INR' check (char_length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  category text not null,
  location_text text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  total_budget numeric(14, 2) not null check (total_budget >= 0),
  status public.job_status not null default 'draft',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint job_worker_not_client check (worker_id is null or worker_id <> client_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  title text not null,
  description text,
  amount numeric(14, 2) not null check (amount > 0),
  status public.milestone_status not null default 'pending',
  auto_release_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, sequence)
);

create table if not exists public.escrow_ledger (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  from_wallet uuid references public.wallets(profile_id) on delete set null,
  to_wallet uuid references public.wallets(profile_id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  type public.ledger_type not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  type public.proof_type not null,
  storage_path text not null,
  caption text,
  geo_lat numeric(9, 6),
  geo_lng numeric(9, 6),
  taken_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  raised_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution_notes text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  vendor_name text not null,
  item_name text not null,
  qty numeric(12, 2) not null check (qty > 0),
  amount numeric(14, 2) not null check (amount >= 0),
  status public.material_status not null default 'requested',
  invoice_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  bid_amount numeric(14, 2) not null check (bid_amount > 0),
  eta_days integer not null check (eta_days > 0),
  message text,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_city on public.profiles(city);

create index if not exists idx_worker_profiles_kyc on public.worker_profiles(kyc_status);
create index if not exists idx_worker_profiles_trust_tier on public.worker_profiles(trust_tier);
create index if not exists idx_worker_profiles_categories_gin on public.worker_profiles using gin(categories);
create index if not exists idx_worker_profiles_skill_tags_gin on public.worker_profiles using gin(skill_tags);

create index if not exists idx_wallets_currency on public.wallets(currency);

create index if not exists idx_jobs_client_id on public.jobs(client_id);
create index if not exists idx_jobs_worker_id on public.jobs(worker_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_category on public.jobs(category);
create index if not exists idx_jobs_created_at on public.jobs(created_at desc);
create index if not exists idx_jobs_lat_lng on public.jobs(lat, lng);

create index if not exists idx_milestones_job_id on public.milestones(job_id);
create index if not exists idx_milestones_status on public.milestones(status);
create index if not exists idx_milestones_auto_release_at on public.milestones(auto_release_at);

create index if not exists idx_escrow_ledger_job_id on public.escrow_ledger(job_id);
create index if not exists idx_escrow_ledger_milestone_id on public.escrow_ledger(milestone_id);
create index if not exists idx_escrow_ledger_type on public.escrow_ledger(type);
create index if not exists idx_escrow_ledger_created_at on public.escrow_ledger(created_at desc);

create index if not exists idx_proofs_milestone_id on public.proofs(milestone_id);
create index if not exists idx_proofs_type on public.proofs(type);
create index if not exists idx_proofs_uploaded_at on public.proofs(uploaded_at desc);

create index if not exists idx_disputes_job_id on public.disputes(job_id);
create index if not exists idx_disputes_milestone_id on public.disputes(milestone_id);
create index if not exists idx_disputes_status on public.disputes(status);
create index if not exists idx_disputes_raised_by on public.disputes(raised_by);
create index if not exists idx_disputes_created_at on public.disputes(created_at desc);

create index if not exists idx_materials_job_id on public.materials(job_id);
create index if not exists idx_materials_status on public.materials(status);

create index if not exists idx_job_applications_job_id on public.job_applications(job_id);
create index if not exists idx_job_applications_worker_id on public.job_applications(worker_id);
create index if not exists idx_job_applications_status on public.job_applications(status);
create index if not exists idx_job_applications_created_at on public.job_applications(created_at desc);

create index if not exists idx_notifications_recipient_id on public.notifications(recipient_id);
create index if not exists idx_notifications_read_at on public.notifications(read_at);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
