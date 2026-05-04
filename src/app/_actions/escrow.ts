"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fundMilestoneSchema,
  submitMilestoneSchema,
  approveMilestoneSchema,
  disputeMilestoneSchema,
  type FundMilestoneInput,
  type SubmitMilestoneInput,
  type ApproveMilestoneInput,
  type DisputeMilestoneInput,
} from "@/lib/schemas/escrow";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ── Helper ────────────────────────────────────────────────────────────────────
async function getAuthUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Not authenticated");
  return { supabase, userId: user.id };
}

// ── Fund Milestone ────────────────────────────────────────────────────────────
// pending → funded: calls fund_escrow() SECURITY DEFINER function
export async function fundMilestoneAction(
  raw: FundMilestoneInput,
): Promise<ActionResult<{ ledgerId: string }>> {
  try {
    const parsed = fundMilestoneSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();
    const { milestone_id } = parsed.data;

    // Call the SECURITY DEFINER function — all wallet mutation is server-side
    const { data, error } = await supabase.rpc("fund_escrow", {
      p_milestone_id: milestone_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // TODO: Sentry.captureException(err);
    return { success: false, error: msg };
  }
}

// ── Submit Milestone ──────────────────────────────────────────────────────────
// funded → submitted: calls submit_milestone() SECURITY DEFINER function
export async function submitMilestoneAction(
  raw: SubmitMilestoneInput,
): Promise<ActionResult<{ milestoneId: string }>> {
  try {
    const parsed = submitMilestoneSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();
    const { milestone_id } = parsed.data;

    // TODO: Phase 5 — proof upload before submitting
    const { data, error } = await supabase.rpc("submit_milestone", {
      p_milestone_id: milestone_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { milestoneId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // TODO: Sentry.captureException(err);
    return { success: false, error: msg };
  }
}

// ── Approve Milestone ─────────────────────────────────────────────────────────
// submitted → released: calls approve_milestone() SECURITY DEFINER function
export async function approveMilestoneAction(
  raw: ApproveMilestoneInput,
): Promise<ActionResult<{ ledgerId: string }>> {
  try {
    const parsed = approveMilestoneSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();
    const { milestone_id } = parsed.data;

    const { data, error } = await supabase.rpc("approve_milestone", {
      p_milestone_id: milestone_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // TODO: Phase 6 — Web Push notification via Edge Function

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // TODO: Sentry.captureException(err);
    return { success: false, error: msg };
  }
}

// ── Dispute Milestone ─────────────────────────────────────────────────────────
// submitted → disputed: calls dispute_milestone() SECURITY DEFINER function
export async function disputeMilestoneAction(
  raw: DisputeMilestoneInput,
): Promise<ActionResult<{ disputeId: string }>> {
  try {
    const parsed = disputeMilestoneSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();
    const { milestone_id, reason } = parsed.data;

    const { data, error } = await supabase.rpc("dispute_milestone", {
      p_milestone_id: milestone_id,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { disputeId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // TODO: Sentry.captureException(err);
    return { success: false, error: msg };
  }
}
