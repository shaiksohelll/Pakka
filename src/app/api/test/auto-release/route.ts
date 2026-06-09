/**
 * POST /api/test/auto-release
 *
 * DEMO_MODE-only test hook used by E2E Playwright smoke tests.
 * Backdates a milestone's auto_release_at by 73 hours (past the 72h window)
 * then calls select auto_release_milestones() via the service-role client.
 *
 * Body: { milestoneId: string }
 * Returns: { released: number }  — row count from the auto-release function
 *
 * Guarded by:
 *  - NEXT_PUBLIC_DEMO_MODE === "true"  (env check)
 *  - E2E_TEST_HOOKS === "1"            (second env check, must be set explicitly)
 *
 * NEVER expose this endpoint in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const TEST_HOOKS = process.env.E2E_TEST_HOOKS === "1";

export async function POST(req: NextRequest) {
  // Double-gate: both flags must be set
  if (!DEMO_MODE || !TEST_HOOKS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let milestoneId: string;
  try {
    const body = await req.json();
    milestoneId = body?.milestoneId;
    if (!milestoneId || typeof milestoneId !== "string") {
      return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Use service-role to bypass RLS and call the privileged function
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Backdate auto_release_at to 73 hours ago (past the 72h release window)
  const backdated = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
  const { error: updateErr } = await supabase
    .from("milestones")
    .update({ auto_release_at: backdated })
    .eq("id", milestoneId)
    .eq("status", "submitted"); // safety: only touch submitted milestones

  if (updateErr) {
    console.error("[test/auto-release] backdate error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. Trigger the auto-release cron function
  const { data, error: rpcErr } = await supabase.rpc("auto_release_milestones");

  if (rpcErr) {
    console.error("[test/auto-release] rpc error:", rpcErr);
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json({ released: data ?? 0 });
}
