-- Pakka seed data
-- Includes: 3 clients, 5 workers (mixed KYC), 1 admin,
-- 4 jobs in different states, milestones for all UI states,
-- sample escrow ledger entries, applications, materials, disputes, notifications.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'client1@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ravi Kumar"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'client2@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Anita Verma"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'client3@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Farhan Ali"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'worker1@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Suresh Mason"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'worker2@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Kiran Electrician"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated',
    'authenticated',
    'worker3@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Imran Plumber"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated',
    'authenticated',
    'worker4@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Rakesh Painter"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated',
    'authenticated',
    'worker5@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Vijay Carpenter"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999999',
    'authenticated',
    'authenticated',
    'admin@pakka.test',
    crypt('Password@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Pakka Admin"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, phone, city)
values
  ('11111111-1111-4111-8111-111111111111', 'client', 'Ravi Kumar', '+919900000001', 'Hyderabad'),
  ('22222222-2222-4222-8222-222222222222', 'client', 'Anita Verma', '+919900000002', 'Bengaluru'),
  ('33333333-3333-4333-8333-333333333333', 'client', 'Farhan Ali', '+919900000003', 'Chennai'),
  ('44444444-4444-4444-8444-444444444444', 'worker', 'Suresh Mason', '+919900000004', 'Hyderabad'),
  ('55555555-5555-4555-8555-555555555555', 'worker', 'Kiran Electrician', '+919900000005', 'Bengaluru'),
  ('66666666-6666-4666-8666-666666666666', 'worker', 'Imran Plumber', '+919900000006', 'Chennai'),
  ('77777777-7777-4777-8777-777777777777', 'worker', 'Rakesh Painter', '+919900000007', 'Hyderabad'),
  ('88888888-8888-4888-8888-888888888888', 'worker', 'Vijay Carpenter', '+919900000008', 'Bengaluru'),
  ('99999999-9999-4999-8999-999999999999', 'admin', 'Pakka Admin', '+919900000009', 'Remote')
on conflict (id) do update
set role = excluded.role,
    full_name = excluded.full_name,
    phone = excluded.phone,
    city = excluded.city;

insert into public.worker_profiles (
  profile_id,
  kyc_status,
  aadhaar_last4,
  pan_last4,
  selfie_url,
  categories,
  skill_tags,
  trust_tier,
  rating,
  jobs_completed
)
values
  (
    '44444444-4444-4444-8444-444444444444',
    'verified',
    '1122',
    'A1B2',
    'https://cdn.pakka.test/selfies/worker1.jpg',
    array['masonry', 'tiling'],
    array['cement', 'plaster', 'civil'],
    'gold',
    4.80,
    62
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'verified',
    '2233',
    'C3D4',
    'https://cdn.pakka.test/selfies/worker2.jpg',
    array['electrical', 'wiring'],
    array['switchboard', 'rewiring', 'safety'],
    'silver',
    4.55,
    41
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'pending',
    '3344',
    'E5F6',
    'https://cdn.pakka.test/selfies/worker3.jpg',
    array['plumbing'],
    array['leak-fix', 'bathroom', 'pipework'],
    'bronze',
    4.20,
    18
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'rejected',
    '4455',
    'G7H8',
    'https://cdn.pakka.test/selfies/worker4.jpg',
    array['painting'],
    array['primer', 'texture', 'wall-finish'],
    'bronze',
    3.90,
    9
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    'verified',
    '5566',
    'I9J0',
    'https://cdn.pakka.test/selfies/worker5.jpg',
    array['carpentry', 'furniture'],
    array['modular', 'wardrobe', 'repair'],
    'silver',
    4.35,
    27
  )
on conflict (profile_id) do update
set kyc_status = excluded.kyc_status,
    aadhaar_last4 = excluded.aadhaar_last4,
    pan_last4 = excluded.pan_last4,
    selfie_url = excluded.selfie_url,
    categories = excluded.categories,
    skill_tags = excluded.skill_tags,
    trust_tier = excluded.trust_tier,
    rating = excluded.rating,
    jobs_completed = excluded.jobs_completed;

update public.wallets
set available_balance = case profile_id
    when '11111111-1111-4111-8111-111111111111' then 40000
    when '22222222-2222-4222-8222-222222222222' then 25000
    when '33333333-3333-4333-8333-333333333333' then 15000
    when '44444444-4444-4444-8444-444444444444' then 12000
    when '55555555-5555-4555-8555-555555555555' then 9000
    when '66666666-6666-4666-8666-666666666666' then 3000
    when '77777777-7777-4777-8777-777777777777' then 1500
    when '88888888-8888-4888-8888-888888888888' then 2200
    else available_balance
  end,
  locked_balance = case profile_id
    when '11111111-1111-4111-8111-111111111111' then 5000
    when '22222222-2222-4222-8222-222222222222' then 8000
    when '33333333-3333-4333-8333-333333333333' then 6000
    else 0
  end,
  currency = 'INR'
where profile_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888'
);

insert into public.jobs (
  id,
  client_id,
  worker_id,
  title,
  description,
  category,
  location_text,
  lat,
  lng,
  total_budget,
  status,
  created_at,
  accepted_at
)
values
  (
    'aaaa0000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    null,
    'Bathroom tile repair',
    'Replace cracked tiles and reseal joints.',
    'tiling',
    'Madhapur, Hyderabad',
    17.448300,
    78.391500,
    12000,
    'open',
    now() - interval '2 days',
    null
  ),
  (
    'aaaa0000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'Kitchen platform reinforcement',
    'Civil strengthening and edge finishing.',
    'masonry',
    'Kondapur, Hyderabad',
    17.470100,
    78.360600,
    18000,
    'assigned',
    now() - interval '5 days',
    now() - interval '4 days'
  ),
  (
    'aaaa0000-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    'Full apartment rewiring',
    'Replace old wiring and install modular switches.',
    'electrical',
    'HSR Layout, Bengaluru',
    12.911600,
    77.647400,
    48000,
    'in_progress',
    now() - interval '8 days',
    now() - interval '7 days'
  ),
  (
    'aaaa0000-0000-4000-8000-000000000004',
    '33333333-3333-4333-8333-333333333333',
    '66666666-6666-4666-8666-666666666666',
    'Pipeline leak and wall restoration',
    'Leak fix with post-repair patchwork.',
    'plumbing',
    'Anna Nagar, Chennai',
    13.085000,
    80.210100,
    22000,
    'disputed',
    now() - interval '10 days',
    now() - interval '9 days'
  )
on conflict (id) do update
set worker_id = excluded.worker_id,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    location_text = excluded.location_text,
    lat = excluded.lat,
    lng = excluded.lng,
    total_budget = excluded.total_budget,
    status = excluded.status,
    accepted_at = excluded.accepted_at;

insert into public.milestones (
  id,
  job_id,
  sequence,
  title,
  description,
  amount,
  status,
  auto_release_at,
  submitted_at,
  approved_at,
  created_at
)
values
  (
    'bbbb0000-0000-4000-8000-000000000011',
    'aaaa0000-0000-4000-8000-000000000001',
    1,
    'Material pickup',
    'Tiles, grout and sealant procurement.',
    4000,
    'pending',
    null,
    null,
    null,
    now() - interval '2 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000021',
    'aaaa0000-0000-4000-8000-000000000002',
    1,
    'Base reinforcement',
    'Strengthening frame and base prep.',
    2000,
    'funded',
    now() + interval '2 days',
    null,
    null,
    now() - interval '4 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000022',
    'aaaa0000-0000-4000-8000-000000000002',
    2,
    'Edge finishing',
    'Counter edge leveling and polish.',
    3000,
    'approved',
    now() + interval '1 day',
    now() - interval '10 hours',
    now() - interval '2 hours',
    now() - interval '3 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000031',
    'aaaa0000-0000-4000-8000-000000000003',
    1,
    'Old wiring removal',
    'Decommission unsafe old lines.',
    8000,
    'submitted',
    now() + interval '3 days',
    now() - interval '6 hours',
    null,
    now() - interval '7 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000032',
    'aaaa0000-0000-4000-8000-000000000003',
    2,
    'Switchboard installation',
    'Install and test modular switchboards.',
    5000,
    'released',
    now() - interval '1 day',
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '6 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000041',
    'aaaa0000-0000-4000-8000-000000000004',
    1,
    'Leak repair',
    'Identify root cause and seal breakage.',
    6000,
    'disputed',
    now() + interval '2 days',
    now() - interval '12 hours',
    null,
    now() - interval '9 days'
  ),
  (
    'bbbb0000-0000-4000-8000-000000000042',
    'aaaa0000-0000-4000-8000-000000000004',
    2,
    'Wall restoration',
    'Re-plaster and repaint affected wall area.',
    3500,
    'refunded',
    now() - interval '3 days',
    now() - interval '5 days',
    now() - interval '4 days',
    now() - interval '8 days'
  )
on conflict (id) do update
set status = excluded.status,
    submitted_at = excluded.submitted_at,
    approved_at = excluded.approved_at,
    auto_release_at = excluded.auto_release_at;

insert into public.escrow_ledger (
  id,
  job_id,
  milestone_id,
  from_wallet,
  to_wallet,
  amount,
  type,
  reference_id,
  created_at
)
values
  (
    'cccc0000-0000-4000-8000-000000000001',
    'aaaa0000-0000-4000-8000-000000000001',
    null,
    null,
    '11111111-1111-4111-8111-111111111111',
    50000,
    'topup',
    gen_random_uuid(),
    now() - interval '7 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000002',
    'aaaa0000-0000-4000-8000-000000000003',
    null,
    null,
    '22222222-2222-4222-8222-222222222222',
    33000,
    'topup',
    gen_random_uuid(),
    now() - interval '9 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000003',
    'aaaa0000-0000-4000-8000-000000000004',
    null,
    null,
    '33333333-3333-4333-8333-333333333333',
    25000,
    'topup',
    gen_random_uuid(),
    now() - interval '11 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000011',
    'aaaa0000-0000-4000-8000-000000000002',
    'bbbb0000-0000-4000-8000-000000000021',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    2000,
    'fund',
    'bbbb0000-0000-4000-8000-000000000021',
    now() - interval '3 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000012',
    'aaaa0000-0000-4000-8000-000000000002',
    'bbbb0000-0000-4000-8000-000000000022',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    3000,
    'fund',
    'bbbb0000-0000-4000-8000-000000000022',
    now() - interval '2 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000013',
    'aaaa0000-0000-4000-8000-000000000003',
    'bbbb0000-0000-4000-8000-000000000031',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    8000,
    'fund',
    'bbbb0000-0000-4000-8000-000000000031',
    now() - interval '2 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000014',
    'aaaa0000-0000-4000-8000-000000000003',
    'bbbb0000-0000-4000-8000-000000000032',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    5000,
    'fund',
    'bbbb0000-0000-4000-8000-000000000032',
    now() - interval '5 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000015',
    'aaaa0000-0000-4000-8000-000000000004',
    'bbbb0000-0000-4000-8000-000000000041',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    6000,
    'fund',
    'bbbb0000-0000-4000-8000-000000000041',
    now() - interval '6 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000016',
    'aaaa0000-0000-4000-8000-000000000004',
    'bbbb0000-0000-4000-8000-000000000042',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    3500,
    'fund',
    'bbbb0000-0000-4000-8000-000000000042',
    now() - interval '7 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000021',
    'aaaa0000-0000-4000-8000-000000000003',
    'bbbb0000-0000-4000-8000-000000000032',
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    5000,
    'release',
    'bbbb0000-0000-4000-8000-000000000032',
    now() - interval '2 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000022',
    'aaaa0000-0000-4000-8000-000000000004',
    'bbbb0000-0000-4000-8000-000000000042',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    3500,
    'refund',
    'bbbb0000-0000-4000-8000-000000000042',
    now() - interval '4 days'
  ),
  (
    'cccc0000-0000-4000-8000-000000000023',
    'aaaa0000-0000-4000-8000-000000000003',
    null,
    '55555555-5555-4555-8555-555555555555',
    null,
    1200,
    'withdraw',
    gen_random_uuid(),
    now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into public.proofs (
  id,
  milestone_id,
  type,
  storage_path,
  caption,
  geo_lat,
  geo_lng,
  taken_at,
  uploaded_at
)
values
  (
    'dddd0000-0000-4000-8000-000000000001',
    'bbbb0000-0000-4000-8000-000000000031',
    'photo',
    'proofs/jobs/3/m31-before.jpg',
    'Old wiring removed from hall area.',
    12.911550,
    77.647350,
    now() - interval '7 hours',
    now() - interval '6 hours'
  ),
  (
    'dddd0000-0000-4000-8000-000000000002',
    'bbbb0000-0000-4000-8000-000000000032',
    'video',
    'proofs/jobs/3/m32-test-video.mp4',
    'Live switchboard load test.',
    12.911620,
    77.647420,
    now() - interval '3 days',
    now() - interval '3 days'
  ),
  (
    'dddd0000-0000-4000-8000-000000000003',
    'bbbb0000-0000-4000-8000-000000000041',
    'photo',
    'proofs/jobs/4/m41-leak-site.jpg',
    'Leak still visible after claimed fix.',
    13.085020,
    80.210050,
    now() - interval '11 hours',
    now() - interval '10 hours'
  )
on conflict (id) do nothing;

insert into public.disputes (
  id,
  job_id,
  milestone_id,
  raised_by,
  reason,
  status,
  resolution_notes,
  resolved_by,
  created_at,
  resolved_at
)
values
  (
    'eeee0000-0000-4000-8000-000000000001',
    'aaaa0000-0000-4000-8000-000000000004',
    'bbbb0000-0000-4000-8000-000000000041',
    '33333333-3333-4333-8333-333333333333',
    'Water leakage persists near sink joint.',
    'open',
    null,
    null,
    now() - interval '10 hours',
    null
  ),
  (
    'eeee0000-0000-4000-8000-000000000002',
    'aaaa0000-0000-4000-8000-000000000004',
    'bbbb0000-0000-4000-8000-000000000042',
    '66666666-6666-4666-8666-666666666666',
    'Wall restoration scope disputed.',
    'resolved_client',
    'Admin approved refund after re-inspection.',
    '99999999-9999-4999-8999-999999999999',
    now() - interval '5 days',
    now() - interval '4 days'
  ),
  (
    'eeee0000-0000-4000-8000-000000000003',
    'aaaa0000-0000-4000-8000-000000000003',
    'bbbb0000-0000-4000-8000-000000000031',
    '22222222-2222-4222-8222-222222222222',
    'Need additional safety checks before release.',
    'mediating',
    null,
    null,
    now() - interval '1 day',
    null
  ),
  (
    'eeee0000-0000-4000-8000-000000000004',
    'aaaa0000-0000-4000-8000-000000000002',
    'bbbb0000-0000-4000-8000-000000000022',
    '44444444-4444-4444-8444-444444444444',
    'Final polish accepted after revision.',
    'resolved_worker',
    'Released to worker after successful QA.',
    '99999999-9999-4999-8999-999999999999',
    now() - interval '2 days',
    now() - interval '1 day'
  ),
  (
    'eeee0000-0000-4000-8000-000000000005',
    'aaaa0000-0000-4000-8000-000000000001',
    null,
    '11111111-1111-4111-8111-111111111111',
    'Bidding negotiation split due scope change.',
    'split',
    'Client and worker agreed to split extra material cost.',
    '99999999-9999-4999-8999-999999999999',
    now() - interval '12 hours',
    now() - interval '8 hours'
  )
on conflict (id) do nothing;

insert into public.materials (
  id,
  job_id,
  vendor_name,
  item_name,
  qty,
  amount,
  status,
  invoice_url,
  created_at
)
values
  (
    'ffff0000-0000-4000-8000-000000000001',
    'aaaa0000-0000-4000-8000-000000000003',
    'Sri Electricals',
    'Copper wire roll',
    4,
    6400,
    'requested',
    null,
    now() - interval '2 days'
  ),
  (
    'ffff0000-0000-4000-8000-000000000002',
    'aaaa0000-0000-4000-8000-000000000003',
    'Sri Electricals',
    'MCB set',
    1,
    2200,
    'paid',
    'https://cdn.pakka.test/invoices/mcb-set.pdf',
    now() - interval '2 days'
  ),
  (
    'ffff0000-0000-4000-8000-000000000003',
    'aaaa0000-0000-4000-8000-000000000003',
    'HomeBuild Supplies',
    'Switchboards (modular)',
    6,
    7800,
    'delivered',
    'https://cdn.pakka.test/invoices/switchboards.pdf',
    now() - interval '3 days'
  )
on conflict (id) do nothing;

insert into public.job_applications (
  id,
  job_id,
  worker_id,
  bid_amount,
  eta_days,
  message,
  status,
  created_at
)
values
  (
    '12121212-0000-4000-8000-000000000001',
    'aaaa0000-0000-4000-8000-000000000001',
    '77777777-7777-4777-8777-777777777777',
    11000,
    3,
    'Can start tomorrow, includes putty finishing.',
    'pending',
    now() - interval '1 day'
  ),
  (
    '12121212-0000-4000-8000-000000000002',
    'aaaa0000-0000-4000-8000-000000000001',
    '88888888-8888-4888-8888-888888888888',
    11800,
    2,
    'Fast turnaround with quality guarantee.',
    'shortlisted',
    now() - interval '20 hours'
  ),
  (
    '12121212-0000-4000-8000-000000000003',
    'aaaa0000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    12200,
    4,
    'Can bundle minor plumbing checks as addon.',
    'rejected',
    now() - interval '15 hours'
  )
on conflict (id) do nothing;

insert into public.notifications (
  id,
  recipient_id,
  type,
  title,
  body,
  data,
  read_at,
  created_at
)
values
  (
    '13131313-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'job_application',
    'New bid received',
    'Two workers have applied to Bathroom tile repair.',
    '{"job_id":"aaaa0000-0000-4000-8000-000000000001"}'::jsonb,
    null,
    now() - interval '18 hours'
  ),
  (
    '13131313-0000-4000-8000-000000000002',
    '55555555-5555-4555-8555-555555555555',
    'milestone_release',
    'Milestone released',
    'Switchboard installation milestone amount has been released.',
    '{"milestone_id":"bbbb0000-0000-4000-8000-000000000032"}'::jsonb,
    now() - interval '1 day',
    now() - interval '2 days'
  ),
  (
    '13131313-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    'dispute_opened',
    'Dispute is now open',
    'Your dispute on leak repair is under review.',
    '{"dispute_id":"eeee0000-0000-4000-8000-000000000001"}'::jsonb,
    null,
    now() - interval '9 hours'
  ),
  (
    '13131313-0000-4000-8000-000000000004',
    '99999999-9999-4999-8999-999999999999',
    'admin_alert',
    'Mediation required',
    'An active dispute needs admin intervention.',
    '{"job_id":"aaaa0000-0000-4000-8000-000000000004"}'::jsonb,
    null,
    now() - interval '8 hours'
  )
on conflict (id) do nothing;

commit;
