"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";
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
import { mapEscrowRpcError } from "@/lib/rpc-errors";

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
    const { milestone_id, idempotency_key } = parsed.data;

    // Call the SECURITY DEFINER function — all wallet mutation is server-side
    const { data, error } = await supabase.rpc("fund_escrow", {
      p_milestone_id: milestone_id,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const friendly = mapEscrowRpcError("fund", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[escrow:fund]", error.code, error.message, error.details);
      // TODO: Sentry.captureException(error);
      return { success: false, error: "Could not fund milestone. Please try again." };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    console.error("[escrow:fund] unexpected", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not fund milestone. Please try again." };
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
    const { milestone_id, idempotency_key } = parsed.data;

    // TODO: Phase 5 — proof upload before submitting
    const { data, error } = await supabase.rpc("submit_milestone", {
      p_milestone_id: milestone_id,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const friendly = mapEscrowRpcError("submit", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[escrow:submit]", error.code, error.message, error.details);
      // TODO: Sentry.captureException(error);
      return { success: false, error: "Could not submit milestone. Please try again." };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { milestoneId: data as string } };
  } catch (err) {
    console.error("[escrow:submit] unexpected", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not submit milestone. Please try again." };
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
    const { milestone_id, idempotency_key } = parsed.data;

    const { data, error } = await supabase.rpc("approve_milestone", {
      p_milestone_id: milestone_id,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const friendly = mapEscrowRpcError("approve", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[escrow:approve]", error.code, error.message, error.details);
      // TODO: Sentry.captureException(error);
      return { success: false, error: "Could not approve milestone. Please try again." };
    }

    // TODO: Phase 6 — Web Push notification via Edge Function

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    console.error("[escrow:approve] unexpected", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not approve milestone. Please try again." };
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
    const { milestone_id, reason, idempotency_key } = parsed.data;

    const { data, error } = await supabase.rpc("dispute_milestone", {
      p_milestone_id: milestone_id,
      p_reason: reason,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const friendly = mapEscrowRpcError("dispute", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[escrow:dispute]", error.code, error.message, error.details);
      // TODO: Sentry.captureException(error);
      return { success: false, error: "Could not raise dispute. Please try again." };
    }

    revalidatePath("/client/jobs", "layout");
    revalidatePath("/worker/jobs", "layout");
    return { success: true, data: { disputeId: data as string } };
  } catch (err) {
    console.error("[escrow:dispute] unexpected", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not raise dispute. Please try again." };
  }
}
