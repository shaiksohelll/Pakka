-- Phase 1 Schema: Pakka core tables
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles: users identified by UUIDs; India-only domain enforced by app logic
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('client','worker','admin')),
  full_name TEXT,
  phone TEXT UNIQUE,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workers profile extended info
CREATE TABLE IF NOT EXISTS worker_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  kyc_status TEXT NOT NULL CHECK (kyc_status IN ('pending','verified','rejected')),
  aadhaar_last4 CHAR(4),
  pan_last4 CHAR(4),
  selfie_url TEXT,
  categories TEXT[],
  skill_tags TEXT[],
  trust_tier TEXT NOT NULL CHECK (trust_tier IN ('bronze','silver','gold')),
  rating NUMERIC,
  jobs_completed INT
);

-- Wallet balances (one per profile)
CREATE TABLE IF NOT EXISTS wallets (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  locked_balance NUMERIC DEFAULT 0 NOT NULL,
  available_balance NUMERIC DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'INR'
);

-- Jobs posted by clients
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  worker_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  location_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  total_budget NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','open','assigned','in_progress','completed','cancelled','disputed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Milestones per job
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  sequence INT NOT NULL,
  title TEXT,
  description TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','funded','submitted','approved','disputed','released','refunded')),
  auto_release_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);

-- Append-only ledger of money movements
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  milestone_id UUID REFERENCES milestones(id),
  from_wallet UUID REFERENCES wallets(profile_id),
  to_wallet UUID REFERENCES wallets(profile_id),
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fund','release','refund','topup','withdraw')),
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Proofs uploaded for milestones
CREATE TABLE IF NOT EXISTS proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES milestones(id),
  type TEXT NOT NULL CHECK (type IN ('photo','video')),
  storage_path TEXT,
  caption TEXT,
  geo_lat NUMERIC,
  geo_lng NUMERIC,
  taken_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Disputes per job/milestone
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  milestone_id UUID REFERENCES milestones(id),
  raised_by UUID REFERENCES profiles(id),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','mediating','resolved_client','resolved_worker','split')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Materials for jobs
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  vendor_name TEXT,
  item_name TEXT,
  qty INT,
  amount NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('requested','paid','delivered')),
  invoice_url TEXT
);

-- Worker applications to jobs
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  worker_id UUID REFERENCES profiles(id),
  bid_amount NUMERIC,
  eta_days INT,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES profiles(id),
  type TEXT,
  title TEXT,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
