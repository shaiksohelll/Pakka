Data Model — Pakka Escrow Marketplace

Overview
- Pakka is a two-sided marketplace for local trades where clients post jobs and fund milestones. Escrow funds move only via SECURITY DEFINER functions and every mutation is audited through RLS-protected rows with server-side authorization.
- The data model emphasizes a strong separation of concerns: profiles define users, wallets track balances, jobs describe work, milestones drive funding, and the ledger records all money movements in an append-only fashion.

Tables

- profiles (id uuid PK, role text CHECK (role IN ('client','worker','admin')), full_name text, phone text UNIQUE, city text, created_at timestamptz default now())
- worker_profiles (profile_id uuid PK references profiles(id), kyc_status text CHECK (kyc_status IN ('pending','verified','rejected')), aadhaar_last4 text(4), pan_last4 text(4), selfie_url text, categories text[], skill_tags text[], trust_tier text CHECK (trust_tier IN ('bronze','silver','gold')), rating numeric, jobs_completed int)
- wallets (profile_id uuid PK references profiles(id), locked_balance numeric DEFAULT 0 CHECK (locked_balance >= 0), available_balance numeric DEFAULT 0 CHECK (available_balance >= 0), currency text DEFAULT 'INR')
- jobs (id uuid PK, client_id uuid REFERENCES profiles(id), worker_id uuid REFERENCES profiles(id) NULL, title text, description text, category text, location_text text, lat double precision, lng double precision, total_budget numeric, status text CHECK (status IN ('draft','open','assigned','in_progress','completed','cancelled','disputed')), created_at timestamptz DEFAULT now(), accepted_at timestamptz)
- milestones (id uuid PK, job_id uuid REFERENCES jobs(id), sequence int, title text, description text, amount numeric, status text CHECK (status IN ('pending','funded','submitted','approved','disputed','released','refunded')), auto_release_at timestamptz, submitted_at timestamptz, approved_at timestamptz)
- escrow_ledger (id uuid PK, job_id uuid REFERENCES jobs(id), milestone_id uuid REFERENCES milestones(id), from_wallet uuid REFERENCES wallets(profile_id), to_wallet uuid REFERENCES wallets(profile_id), amount numeric, type text CHECK (type IN ('fund','release','refund','topup','withdraw')), reference_id text, created_at timestamptz DEFAULT now())
- proofs (id uuid PK, milestone_id uuid REFERENCES milestones(id), type text CHECK (type IN ('photo','video')), storage_path text, caption text, geo_lat numeric, geo_lng numeric, taken_at timestamptz, uploaded_at timestamptz)
- disputes (id uuid PK, job_id uuid REFERENCES jobs(id), milestone_id uuid REFERENCES milestones(id), raised_by uuid REFERENCES profiles(id), reason text, status text CHECK (status IN ('open','mediating','resolved_client','resolved_worker','split')), resolution_notes text, resolved_by uuid REFERENCES profiles(id), created_at timestamptz DEFAULT now(), resolved_at timestamptz)
- materials (id uuid PK, job_id uuid REFERENCES jobs(id), vendor_name text, item_name text, qty int, amount numeric, status text CHECK (status IN ('requested','paid','delivered')), invoice_url text)
- job_applications (id uuid PK, job_id uuid REFERENCES jobs(id), worker_id uuid REFERENCES profiles(id), bid_amount numeric, eta_days int, message text, status text CHECK (status IN ('pending','accepted','rejected')), created_at timestamptz DEFAULT now())
- notifications (id uuid PK, recipient_id uuid REFERENCES profiles(id), type text, title text, body text, data jsonb, read_at timestamptz, created_at timestamptz DEFAULT now())

Indexes (suggested)
- CREATE INDEX ON wallets(profile_id);
- CREATE INDEX ON jobs(client_id);
- CREATE INDEX ON jobs(worker_id);
- CREATE INDEX ON milestones(job_id);
- CREATE INDEX ON milestones(milestone_id);
- CREATE INDEX ON escrow_ledger(milestone_id);
- CREATE INDEX ON proofs(milestone_id);
- CREATE INDEX ON disputes(job_id);
- CREATE INDEX ON job_applications(job_id);
- CREATE INDEX ON notifications(recipient_id);

RLS and Security Intent
- profiles: user reads own row only; cross-user reads go through SECURITY DEFINER RPCs.
- wallets: read protected; writes only via SECURITY DEFINER functions; client cannot mutate directly.
- escrow_ledger: read-only for participants of the associated job via RPCs; insertions occur via Edge Functions (SECURITY DEFINER).
- jobs: read by client for own jobs; workers see open jobs and jobs assigned to them; writes via server actions.
- milestones: read by job participants; writes gated behind SECURITY DEFINER RPCs.
- All money-related fields and balances computed via server-side RPCs; no client-side balance math.

Security Definer Helpers (high level)
- is_admin() returns boolean
- fund_escrow(milestone_id)
- submit_milestone(milestone_id)
- approve_milestone(milestone_id)
- dispute_milestone(milestone_id, reason)
- admin_force_release(milestone_id)
- admin_refund(milestone_id)
- auto_release_milestones()

Notes
- All money movement must be atomic and audited via escrow_ledger with zero-sum invariants.
- Use SELECT FOR UPDATE when mutating wallets in SECURITY DEFINER calls to avoid race conditions.
- RLS policies should be as restrictive as possible with admin bypass only where required.
