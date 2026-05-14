-- Seed demo users, jobs, milestones, and ledger entries for Phase 1 demo state

-- Clients (3)
INSERT INTO profiles (id, role, full_name, phone, city, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'client', 'Aarav Kumar', '+919876500001', 'Hyderabad', now()),
('11111111-1111-1111-1111-111111111112', 'client', 'Sohel Rahman', '+919876500002', 'Hyderabad', now()),
('11111111-1111-1111-1111-111111111113', 'client', 'Riya Verma', '+919876500003', 'Delhi', now());

-- Workers (5)
INSERT INTO profiles (id, role, full_name, phone, city, created_at) VALUES
('22222222-2222-2222-2222-222222222221', 'worker', 'Ravi Sharma', '+919876500011', 'Hyderabad', now()),
('33333333-3333-3333-3333-333333333331', 'worker', 'Arpita Gupta', '+919876500012', 'Hyderabad', now()),
('44444444-4444-4444-4444-444444444444', 'worker', 'Lalit Mehra', '+919876500013', 'Delhi', now()),
('55555555-5555-5555-5555-555555555555', 'worker', 'Meera Kapoor', '+919876500014', 'Chennai', now()),
('66666666-6666-6666-6666-666666666666', 'worker', 'Vikram Das', '+919876500015', 'Bengaluru', now());

-- Wallets (one per profile)
INSERT INTO wallets (profile_id, locked_balance, available_balance, currency) VALUES
('11111111-1111-1111-1111-111111111111', 0, 0, 'INR'),
('11111111-1111-1111-1111-111111111112', 0, 0, 'INR'),
('11111111-1111-1111-1111-111111111113', 0, 0, 'INR'),
('22222222-2222-2222-2222-222222222221', 0, 0, 'INR'),
('33333333-3333-3333-3333-333333333331', 0, 0, 'INR'),
('44444444-4444-4444-4444-444444444444', 0, 0, 'INR'),
('55555555-5555-5555-5555-555555555555', 0, 0, 'INR'),
('66666666-6666-6666-6666-666666666666', 0, 0, 'INR');

-- Jobs (4)
INSERT INTO jobs (id, client_id, worker_id, title, description, category, location_text, lat, lng, total_budget, status, created_at, accepted_at) VALUES
('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', NULL, 'Fix Kitchen Sink', 'Repair leaking kitchen sink', 'plumbing', 'Hyderabad', 17.3850, 78.4867, 15000, 'open', now(), NULL),
('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222221', 'Bathroom Waterproofing', 'Waterproof bathroom walls', 'plumbing', 'Hyderabad', 17.3850, 78.4867, 20000, 'open', now(), NULL),
('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Electrical Wiring Upgrade', 'Upgrade wiring in living room', 'electrical', 'Delhi', 28.6353, 77.2300, 18000, 'open', now(), NULL),
('77777777-7777-7777-7777-777777777704', '11111111-1111-1111-1111-111111111113', NULL, 'AC Repair', 'AC servicing and repair', 'appliance', 'Delhi', 28.6139, 77.2090, 12000, 'open', now(), NULL);

-- Milestones (one per job for demo)
INSERT INTO milestones (id, job_id, sequence, title, description, amount, status, auto_release_at) VALUES
('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777701', 1, 'Milestone 1', 'Fix the sink and verify', 15000, 'funded', now() + interval '72 hours'),
('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777702', 1, 'Milestone 1', 'Waterproofing scope', 20000, 'funded', now() + interval '72 hours');

-- Ledger entries (funds moved)
INSERT INTO escrow_ledger (id, job_id, milestone_id, from_wallet, to_wallet, amount, type, reference_id, created_at) VALUES
('99999999-9999-9999-9999-999999999991', '77777777-7777-7777-7777-777777777701', '88888888-8888-8888-8888-888888888881', NULL, '11111111-1111-1111-1111-111111111111', 15000, 'fund', 'ref-1', now()),
('99999999-9999-9999-9999-999999999992', '77777777-7777-7777-7777-777777777702', '88888888-8888-8888-8888-888888888882', NULL, '11111111-1111-1111-1111-111111111112', 20000, 'fund', 'ref-2', now());

-- Proofs and proposals to seed UI
INSERT INTO proofs (id, milestone_id, type, storage_path, caption, taken_at, uploaded_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888881', 'photo', 'kyc/1/photo1.jpg', 'Proof photo', now(), now());
