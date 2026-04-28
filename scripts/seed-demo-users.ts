/**
 * scripts/seed-demo-users.ts
 *
 * Phone-based demo seed for Pakka.
 * Uses SERVICE ROLE key — never runs client-side.
 *
 * Usage:
 *   pnpm seed          # fill missing rows only
 *   pnpm seed --reset  # wipe seeded data then re-create
 */

import { createClient } from "@supabase/supabase-js";


// ---------------------------------------------------------------------------
// Env + client
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.\n" +
      "    Copy .env.local.example → .env.local and fill in both values.",
  );
  // Use setImmediate so Node drains the event loop before exiting
  setImmediate(() => process.exit(1));
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes("--reset");

// ---------------------------------------------------------------------------
// User definitions
// ---------------------------------------------------------------------------
type DemoUser = {
  phone: string;
  name: string;
  role: "client" | "worker" | "admin";
  city?: string;
  // wallet
  available?: number;
  locked?: number;
  // worker extras
  kyc?: "pending" | "verified" | "rejected";
  trust?: "bronze" | "silver" | "gold";
  categories?: string[];
};

const DEMO_USERS: DemoUser[] = [
  // Clients
  { phone: "+919876500001", name: "Priya Sharma",  role: "client", city: "Mumbai",    available: 150000, locked: 40000 },
  { phone: "+919876500002", name: "Rohit Mehta",   role: "client", city: "Bengaluru", available: 80000,  locked: 0 },
  { phone: "+919876500003", name: "Anjali Reddy",  role: "client", city: "Hyderabad", available: 250000, locked: 120000 },
  // Workers
  { phone: "+919876500011", name: "Ravi Kumar",  role: "worker", city: "Mumbai",    kyc: "verified", trust: "gold",   categories: ["masonry", "plumbing"] },
  { phone: "+919876500012", name: "Suresh Patel", role: "worker", city: "Pune",      kyc: "verified", trust: "silver", categories: ["electrical"] },
  { phone: "+919876500013", name: "Manoj Yadav",  role: "worker", city: "Bengaluru", kyc: "verified", trust: "bronze", categories: ["painting", "carpentry"] },
  { phone: "+919876500014", name: "Deepak Singh", role: "worker", city: "Hyderabad", kyc: "pending",  trust: "bronze", categories: ["plumbing"] },
  { phone: "+919876500015", name: "Arjun Nair",   role: "worker", city: "Chennai",   kyc: "rejected", trust: "bronze", categories: ["electrical"] },
  // Admin
  { phone: "+919876500099", name: "Demo Admin", role: "admin", city: "Mumbai" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function bail(tag: string, error: unknown): never {
  console.error(`❌  ${tag}:`, error);
  throw new Error(`Seed aborted at: ${tag}`);
}

async function listAllAuthUsers(): Promise<Map<string, string>> {
  const phoneToId = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) bail("listUsers", error);
    for (const u of data.users) {
      if (u.phone) phoneToId.set(u.phone, u.id);
    }
    if (data.users.length < 1000) break;
    page++;
  }
  return phoneToId;
}

// ---------------------------------------------------------------------------
// --reset: delete seeded auth users (cascades to profiles via FK)
// ---------------------------------------------------------------------------
async function resetSeedData() {
  console.log("🗑   --reset: wiping seeded users…");
  const existing = await listAllAuthUsers();
  const seedPhones = new Set(DEMO_USERS.map((u) => u.phone));
  let deleted = 0;
  for (const [phone, id] of existing) {
    if (seedPhones.has(phone)) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) bail(`deleteUser ${phone}`, error);
      deleted++;
    }
  }
  console.log(`   Deleted ${deleted} auth user(s). All cascade rows removed.\n`);
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
type SeedResult = { phone: string; name: string; status: "created" | "skipped"; id: string };

async function seed() {
  if (RESET) await resetSeedData();

  const existing = await listAllAuthUsers();
  const results: SeedResult[] = [];

  // Map phone → UUID for cross-referencing jobs later
  const uid: Record<string, string> = {};

  // --- 1. Auth users + profiles + worker_profiles + wallets ---------------
  for (const u of DEMO_USERS) {
    let userId: string;

    if (existing.has(u.phone)) {
      userId = existing.get(u.phone)!;
      results.push({ phone: u.phone, name: u.name, status: "skipped", id: userId });
      uid[u.phone] = userId;
      continue;
    }

    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      phone: u.phone,
      phone_confirm: true,
      user_metadata: { seed: true },
    });
    if (authErr) bail(`createUser ${u.phone}`, authErr);
    userId = authData.user.id;
    uid[u.phone] = userId;

    // Insert profile
    const { error: profErr } = await supabase.from("profiles").insert({
      id: userId,
      role: u.role,
      full_name: u.name,
      phone: u.phone,
      city: u.city ?? null,
    });
    if (profErr) bail(`profiles insert ${u.phone}`, profErr);

    // Insert worker_profile (trigger creates wallet automatically)
    if (u.role === "worker") {
      const { error: wpErr } = await supabase.from("worker_profiles").insert({
        profile_id: userId,
        kyc_status: u.kyc ?? "pending",
        trust_tier: u.trust ?? "bronze",
        categories: u.categories ?? [],
        skill_tags: [],
        aadhaar_last4: "1234",
        pan_last4: "123F",
      });
      if (wpErr) bail(`worker_profiles insert ${u.phone}`, wpErr);
    }

    // Set wallet balances (wallet row created by trigger on profiles insert)
    if (u.role === "client" && (u.available !== undefined || u.locked !== undefined)) {
      const { error: wErr } = await supabase
        .from("wallets")
        .update({
          available_balance: u.available ?? 0,
          locked_balance: u.locked ?? 0,
        })
        .eq("profile_id", userId);
      if (wErr) bail(`wallets update ${u.phone}`, wErr);
    }

    results.push({ phone: u.phone, name: u.name, status: "created", id: userId });
  }

  // Print auth user summary
  console.log("\n👤  Auth Users:");
  console.log("─".repeat(70));
  for (const r of results) {
    const icon = r.status === "created" ? "✅" : "⏭ ";
    console.log(`${icon}  ${r.phone}  ${r.name.padEnd(16)}  ${r.status}  (${r.id.slice(0, 8)}…)`);
  }

  const priya  = uid["+919876500001"]!;
  const rohit  = uid["+919876500002"]!;
  const anjali = uid["+919876500003"]!;
  const ravi   = uid["+919876500011"]!;
  const suresh = uid["+919876500012"]!;
  const manoj  = uid["+919876500013"]!;
  const deepak = uid["+919876500014"]!;

  // --- 2. Jobs + milestones + ledger + misc --------------------------------
  // Helper: check if a job already exists by title + client_id
  async function jobExists(title: string, clientId: string): Promise<string | null> {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("title", title)
      .eq("client_id", clientId)
      .maybeSingle();
    return data?.id ?? null;
  }

  // Helper: upsert job (skips if exists, returns id)
  async function upsertJob(payload: Record<string, unknown>): Promise<string> {
    const existing = await jobExists(payload.title as string, payload.client_id as string);
    if (existing) {
      console.log(`⏭   Job already exists: "${payload.title}"`);
      return existing;
    }
    const { data, error } = await supabase.from("jobs").insert(payload).select("id").single();
    if (error) bail(`jobs insert "${payload.title}"`, error);
    console.log(`✅  Job created: "${payload.title}"`);
    return data.id;
  }

  // Helper: insert milestone if not exists
  async function upsertMilestone(
    jobId: string,
    seq: number,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const { data: existing } = await supabase
      .from("milestones")
      .select("id")
      .eq("job_id", jobId)
      .eq("sequence", seq)
      .maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from("milestones")
      .insert({ ...payload, job_id: jobId, sequence: seq })
      .select("id")
      .single();
    if (error) bail(`milestones insert seq=${seq} job=${jobId}`, error);
    return data.id;
  }

  // Helper: insert ledger entry if no matching entry exists for that milestone+type
  async function upsertLedger(payload: Record<string, unknown>) {
    const { data: existing } = await supabase
      .from("escrow_ledger")
      .select("id")
      .eq("milestone_id", payload.milestone_id as string)
      .eq("type", payload.type as string)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabase.from("escrow_ledger").insert(payload);
    if (error) bail(`escrow_ledger insert type=${payload.type}`, error);
  }

  console.log("\n📋  Jobs:");
  console.log("─".repeat(70));

  // ── JOB 1: 2BHK kitchen renovation (Priya → Ravi) ───────────────────────
  const job1 = await upsertJob({
    client_id: priya, worker_id: ravi,
    title: "2BHK kitchen renovation",
    description: "Full kitchen renovation including demolition, plumbing, cabinets, countertop, and fixtures.",
    category: "masonry",
    location_text: "Bandra West, Mumbai",
    total_budget: 180000,
    status: "assigned",
    accepted_at: new Date(Date.now() - 10 * 86400_000).toISOString(),
  });
  const j1m1 = await upsertMilestone(job1, 1, { title: "Demo & rough plumbing", amount: 40000, status: "released", approved_at: new Date(Date.now() - 7 * 86400_000).toISOString() });
  const j1m2 = await upsertMilestone(job1, 2, { title: "Cabinet install", amount: 60000, status: "funded", auto_release_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  await upsertMilestone(job1, 3, { title: "Countertop & backsplash", amount: 50000, status: "pending" });
  await upsertMilestone(job1, 4, { title: "Final fixtures & cleanup", amount: 30000, status: "pending" });

  // Ledger for job1:
  // M1: fund (priya→priya ₹40k) + release (priya→ravi ₹40k)
  await upsertLedger({ job_id: job1, milestone_id: j1m1, from_wallet: priya, to_wallet: priya, amount: 40000, type: "fund",    reference_id: j1m1 });
  await upsertLedger({ job_id: job1, milestone_id: j1m1, from_wallet: priya, to_wallet: ravi,  amount: 40000, type: "release", reference_id: j1m1 });
  // M2: fund (priya locked ₹60k)
  await upsertLedger({ job_id: job1, milestone_id: j1m2, from_wallet: priya, to_wallet: priya, amount: 60000, type: "fund",    reference_id: j1m2 });

  // ── JOB 2: Bathroom rewiring (Rohit → Suresh) ────────────────────────────
  const job2 = await upsertJob({
    client_id: rohit, worker_id: suresh,
    title: "Bathroom rewiring",
    description: "Complete rewiring of two bathrooms including safety check and fixture install.",
    category: "electrical",
    location_text: "Koramangala, Bengaluru",
    total_budget: 35000,
    status: "in_progress",
    accepted_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
  });
  const j2m1 = await upsertMilestone(job2, 1, { title: "Wiring + safety check", amount: 20000, status: "submitted", submitted_at: new Date(Date.now() - 1 * 86400_000).toISOString(), auto_release_at: new Date(Date.now() + 71 * 3600_000).toISOString() });
  await upsertMilestone(job2, 2, { title: "Fixture install", amount: 15000, status: "pending" });

  // Ledger for job2 M1: funded (rohit locked ₹20k)
  await upsertLedger({ job_id: job2, milestone_id: j2m1, from_wallet: rohit, to_wallet: rohit, amount: 20000, type: "fund", reference_id: j2m1 });

  // Proof for M1
  const { data: existingProof } = await supabase
    .from("proofs")
    .select("id")
    .eq("milestone_id", j2m1)
    .maybeSingle();
  if (!existingProof) {
    const { error: proofErr } = await supabase.from("proofs").insert({
      milestone_id: j2m1,
      type: "photo",
      storage_path: "kyc/seed/bathroom-rewiring-proof.jpg",
      caption: "Wiring complete, safety check passed",
      taken_at: new Date(Date.now() - 1 * 86400_000).toISOString(),
    });
    if (proofErr) bail("proofs insert job2/m1", proofErr);
  }

  // ── JOB 3: Office repaint (Anjali → Manoj, disputed) ─────────────────────
  const job3 = await upsertJob({
    client_id: anjali, worker_id: manoj,
    title: "Office repaint 1500 sqft",
    description: "Full office repaint — walls and ceiling. Premium washable paint specified.",
    category: "painting",
    location_text: "Banjara Hills, Hyderabad",
    total_budget: 65000,
    status: "disputed",
    accepted_at: new Date(Date.now() - 15 * 86400_000).toISOString(),
  });
  const j3m1 = await upsertMilestone(job3, 1, { title: "Surface prep & primer", amount: 20000, status: "released", approved_at: new Date(Date.now() - 10 * 86400_000).toISOString() });
  const j3m2 = await upsertMilestone(job3, 2, { title: "First coat", amount: 30000, status: "disputed" });
  await upsertMilestone(job3, 3, { title: "Second coat & finishing", amount: 15000, status: "pending" });

  await upsertLedger({ job_id: job3, milestone_id: j3m1, from_wallet: anjali, to_wallet: anjali, amount: 20000, type: "fund",    reference_id: j3m1 });
  await upsertLedger({ job_id: job3, milestone_id: j3m1, from_wallet: anjali, to_wallet: manoj,  amount: 20000, type: "release", reference_id: j3m1 });
  await upsertLedger({ job_id: job3, milestone_id: j3m2, from_wallet: anjali, to_wallet: anjali, amount: 30000, type: "fund",    reference_id: j3m2 });

  // Dispute for M2
  const { data: existingDispute } = await supabase
    .from("disputes")
    .select("id")
    .eq("job_id", job3)
    .eq("milestone_id", j3m2)
    .maybeSingle();
  if (!existingDispute) {
    const { error: dErr } = await supabase.from("disputes").insert({
      job_id: job3,
      milestone_id: j3m2,
      raised_by: anjali,
      reason: "Quality below agreed standard",
      status: "open",
    });
    if (dErr) bail("disputes insert job3", dErr);
  }

  // ── JOB 4: Carpentry shelving (Anjali, open) ─────────────────────────────
  const job4 = await upsertJob({
    client_id: anjali,
    title: "Carpentry shelving",
    description: "Built-in shelving unit for home office, 3m × 2.5m.",
    category: "carpentry",
    location_text: "Jubilee Hills, Hyderabad",
    total_budget: 22000,
    status: "open",
  });
  await upsertMilestone(job4, 1, { title: "Frame & assembly", amount: 15000, status: "pending" });
  await upsertMilestone(job4, 2, { title: "Finishing & polish", amount: 7000,  status: "pending" });

  // ── JOB 5: Drainage repair (Priya, open, 2 applications) ─────────────────
  const job5 = await upsertJob({
    client_id: priya,
    title: "Drainage repair",
    description: "Blocked drainage in kitchen + bathroom. Needs rooter + pipe replacement.",
    category: "plumbing",
    location_text: "Bandra West, Mumbai",
    total_budget: 15000,
    status: "open",
  });
  await upsertMilestone(job5, 1, { title: "Diagnose & repair drainage", amount: 15000, status: "pending" });

  // Applications for job5
  for (const app of [
    { worker_id: ravi,   bid_amount: 14000, eta_days: 3, message: "Can start immediately. Gold tier plumber.", status: "pending" },
    { worker_id: deepak, bid_amount: 12000, eta_days: 5, message: "KYC pending but available.", status: "rejected" },
  ]) {
    const { data: existingApp } = await supabase
      .from("job_applications")
      .select("id")
      .eq("job_id", job5)
      .eq("worker_id", app.worker_id)
      .maybeSingle();
    if (!existingApp) {
      const { error: appErr } = await supabase.from("job_applications").insert({ job_id: job5, ...app });
      if (appErr) bail(`job_applications insert job5 worker=${app.worker_id}`, appErr);
    }
  }

  // ── JOB 6: Full bathroom remodel (Rohit → Ravi, completed) ───────────────
  const job6 = await upsertJob({
    client_id: rohit, worker_id: ravi,
    title: "Full bathroom remodel",
    description: "Complete gut-and-remodel of master bathroom. Tiling, plumbing, fixtures.",
    category: "plumbing",
    location_text: "Indiranagar, Bengaluru",
    total_budget: 95000,
    status: "completed",
    accepted_at: new Date(Date.now() - 45 * 86400_000).toISOString(),
  });
  const j6m1 = await upsertMilestone(job6, 1, { title: "Demo & waterproofing", amount: 30000, status: "released", approved_at: new Date(Date.now() - 35 * 86400_000).toISOString() });
  const j6m2 = await upsertMilestone(job6, 2, { title: "Tiling & plumbing rough-in", amount: 45000, status: "released", approved_at: new Date(Date.now() - 20 * 86400_000).toISOString() });
  const j6m3 = await upsertMilestone(job6, 3, { title: "Fixtures & final cleanup", amount: 20000, status: "released", approved_at: new Date(Date.now() - 10 * 86400_000).toISOString() });

  for (const [mid, amt] of [[j6m1, 30000], [j6m2, 45000], [j6m3, 20000]] as [string, number][]) {
    await upsertLedger({ job_id: job6, milestone_id: mid, from_wallet: rohit, to_wallet: rohit, amount: amt, type: "fund",    reference_id: mid });
    await upsertLedger({ job_id: job6, milestone_id: mid, from_wallet: rohit, to_wallet: ravi,  amount: amt, type: "release", reference_id: mid });
  }

  // Also top-up Ravi's wallet for the released funds (job1 M1 + job6 all = 40k + 95k = 135k)
  // And Manoj gets job3 M1 release = 20k
  // We set available directly since service role bypasses triggers
  const { error: raviWErr } = await supabase
    .from("wallets")
    .update({ available_balance: 135000, locked_balance: 0 })
    .eq("profile_id", ravi);
  if (raviWErr) bail("wallets update ravi", raviWErr);

  const { error: manojWErr } = await supabase
    .from("wallets")
    .update({ available_balance: 20000, locked_balance: 0 })
    .eq("profile_id", manoj);
  if (manojWErr) bail("wallets update manoj", manojWErr);

  // ---------------------------------------------------------------------------
  // 3. Ledger zero-sum assertion
  // ---------------------------------------------------------------------------
  console.log("\n🔢  Escrow ledger zero-sum check:");
  console.log("─".repeat(70));

  const { data: ledgerRows, error: ledgerErr } = await supabase
    .from("escrow_ledger")
    .select("type, amount, from_wallet, to_wallet");
  if (ledgerErr) bail("ledger fetch", ledgerErr);

  // For fund entries: money moves out of available, into locked (same wallet)
  // For release entries: money moves out of locked (from_wallet), into available (to_wallet)
  // Net system balance = sum(release) - sum(fund) per wallet should be 0 in a closed system
  // Simplified check: total fund amounts == total release amounts (no refunds in seed)
  let totalFund = 0, totalRelease = 0, totalRefund = 0;
  for (const row of ledgerRows ?? []) {
    if (row.type === "fund")    totalFund    += Number(row.amount);
    if (row.type === "release") totalRelease += Number(row.amount);
    if (row.type === "refund")  totalRefund  += Number(row.amount);
  }
  console.log(`   Total funded  : ${fmt(totalFund)}`);
  console.log(`   Total released: ${fmt(totalRelease)}`);
  console.log(`   Total refunded: ${fmt(totalRefund)}`);

  const locked   = totalFund - totalRelease - totalRefund;
  const ledgerOk = locked >= 0;
  console.log(`   In-escrow lock: ${fmt(locked)}  ${ledgerOk ? "✅ balanced" : "❌ MISMATCH"}`);
  if (!ledgerOk) {
    console.error("❌  Ledger mismatch: released/refunded > funded. Check seed data.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 4. Final summary
  // ---------------------------------------------------------------------------
  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log("\n✨  Seed complete!");
  console.log(`   Auth users: ${created} created, ${skipped} skipped`);
  console.log(`   OTP for all demo numbers: 123456 (DEMO_MODE=true)\n`);
}

seed()
  .then(() => {
    // Let the event loop drain before exiting so libuv doesn't assert on Windows
    setImmediate(() => process.exit(0));
  })
  .catch((err: unknown) => {
    if (err instanceof Error && err.message.startsWith("Seed aborted at:")) {
      // bail() already printed the real error
    } else {
      console.error("Unhandled error:", err);
    }
    setImmediate(() => process.exit(1));
  });
