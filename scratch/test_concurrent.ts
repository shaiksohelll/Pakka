import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get client and worker
  const clientRes = await supabase.from('profiles').select('id').eq('role', 'client').limit(1).single();
  const workerRes = await supabase.from('profiles').select('id').eq('role', 'worker').limit(1).single();
  const client_id = clientRes.data!.id;
  const worker_id = workerRes.data!.id;

  // Give client some money directly in the DB
  await supabase.from('wallets').update({ available_balance: 100000 }).eq('profile_id', client_id);

  const jobRes = await supabase.from('jobs').insert({
    title: 'Test Job',
    description: 'Test',
    category: 'general',
    total_budget: 1000,
    status: 'assigned',
    client_id: client_id,
    worker_id: worker_id
  }).select('id').single();
  if (jobRes.error) throw new Error('Job insert failed: ' + JSON.stringify(jobRes.error));
  const job_id = jobRes.data!.id;

  const mRes = await supabase.from('milestones').insert({
    job_id: job_id,
    title: 'Test Milestone',
    amount: 1000,
    status: 'pending',
    sequence: 1
  }).select('id').single();
  if (mRes.error) throw new Error('Milestone 1 insert failed: ' + JSON.stringify(mRes.error));
  const milestone_id = mRes.data!.id;

  console.log(`Created Job ${job_id} and Milestone ${milestone_id}`);

  const m2Res = await supabase.from('milestones').insert({
    job_id: job_id,
    title: 'Test Milestone 2',
    amount: 1000,
    status: 'pending',
    sequence: 2
  }).select('id').single();
  if (m2Res.error) throw new Error('Milestone 2 insert failed: ' + JSON.stringify(m2Res.error));
  const milestone2_id = m2Res.data!.id;

  const fundKey = '00000000-0000-0000-0000-000000000001';
  const fund1 = await supabase.rpc('fund_escrow', { p_milestone_id: milestone_id, p_idempotency_key: fundKey });
  console.log('Fund 1 (milestone 1):', fund1.error || fund1.data);

  const fundReplay = await supabase.rpc('fund_escrow', { p_milestone_id: milestone_id, p_idempotency_key: fundKey });
  console.log('Fund Replay (same milestone):', fundReplay.error || fundReplay.data);

  const fund2 = await supabase.rpc('fund_escrow', { p_milestone_id: milestone2_id, p_idempotency_key: fundKey });
  console.log('Fund 2 (different milestone, same key):', fund2.error || fund2.data);
  // Expected to fail with 22023

  // Test B: Concurrent double fund_escrow (we will do this on milestone2 with a new key)
  const fundKey2 = '00000000-0000-0000-0000-000000000002';
  const [c_f1, c_f2] = await Promise.all([
    supabase.rpc('fund_escrow', { p_milestone_id: milestone2_id, p_idempotency_key: fundKey2 }),
    supabase.rpc('fund_escrow', { p_milestone_id: milestone2_id, p_idempotency_key: fundKey2 })
  ]);
  console.log('Concurrent Fund 1:', c_f1.error || c_f1.data);
  console.log('Concurrent Fund 2:', c_f2.error || c_f2.data);

  const ledgersFund = await supabase.from('escrow_ledger').select('*').eq('milestone_id', milestone2_id).eq('type', 'fund');
  console.log('Ledger count for milestone 2 fund:', ledgersFund.data?.length);

  // Setup for Release Race
  // Submit milestone 1
  await supabase.rpc('submit_milestone', { p_milestone_id: milestone_id, p_idempotency_key: '00000000-0000-0000-0000-000000000003' });
  
  // Fake auto_release_at to be in the past
  await supabase.from('milestones').update({ auto_release_at: new Date(Date.now() - 100000).toISOString() }).eq('id', milestone_id);

  const wBeforeC = await supabase.from('wallets').select('available_balance, locked_balance').eq('profile_id', client_id).single();
  const wBeforeW = await supabase.from('wallets').select('available_balance, locked_balance').eq('profile_id', worker_id).single();
  
  console.log('Before release:', { client: wBeforeC.data, worker: wBeforeW.data });

  // Test A: Concurrent approve + auto_release
  const relKey = '00000000-0000-0000-0000-000000000004';
  const [rel1, rel2] = await Promise.all([
    supabase.rpc('approve_milestone', { p_milestone_id: milestone_id, p_idempotency_key: relKey }),
    supabase.rpc('auto_release_milestones')
  ]);
  
  console.log('Concurrent Release Approve:', rel1.error || rel1.data);
  console.log('Concurrent Release Auto:', rel2.error || rel2.data);

  const wAfterC = await supabase.from('wallets').select('available_balance, locked_balance').eq('profile_id', client_id).single();
  const wAfterW = await supabase.from('wallets').select('available_balance, locked_balance').eq('profile_id', worker_id).single();

  console.log('After release:', { client: wAfterC.data, worker: wAfterW.data });
  
  const ledgersRel = await supabase.from('escrow_ledger').select('*').eq('milestone_id', milestone_id).eq('type', 'release');
  console.log('Ledger count for milestone 1 release:', ledgersRel.data?.length);
}

run().catch(console.error);
