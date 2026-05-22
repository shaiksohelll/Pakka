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

/**
 * Map a Postgres RPC error from the escrow state-machine functions into a
 * user-friendly string. Routes primarily by the exact exception message from
 * RAISE EXCEPTION (error.message), with a small number of prefix matches via
 * startsWith for parameterised messages (e.g. "Milestone must be funded to
 * submit (current: ...)"). Returns null when the error is unrecognised;
 * callers log the raw error and fall back to the action-specific generic
 * message.
 *
 * Error inventory (from 202604260004_create_escrow_functions.sql and
 * 202604260005_harden_state_machine.sql):
 *
 * fund_escrow:
 *   'Milestone not found'               → shared
 *   'Only job client or admin can fund escrow'
 *   'Milestone must be in pending state'
 *   'Insufficient available balance'
 *
 * submit_milestone:
 *   'Milestone not found'               → shared
 *   'Job has no assigned worker'        → shared
 *   'Only assigned worker or admin can submit milestone'
 *   'Milestone must be funded to submit (current: %)'  (startsWith match)
 *
 * approve_milestone:
 *   'Milestone not found'               → shared
 *   'Job has no assigned worker'        → shared
 *   'Only job client or admin can approve milestone'
 *   'Milestone must be funded/submitted/approved'
 *   'Insufficient locked balance'
 *
 * dispute_milestone:
 *   'Reason is required'
 *   'Milestone not found'               → shared
 *   'Only job participants or admin can raise dispute'
 *   'Cannot dispute released/refunded milestone'
 */
function mapEscrowRpcError(
  action: "fund" | "submit" | "approve" | "dispute",
  error: PostgrestError,
): string | null {
  const msg = error.message ?? "";

  // ── Shared messages across multiple functions ────────────────────────────
  if (msg === "Milestone not found") return "Milestone not found.";
  if (msg === "Job has no assigned worker") return "No worker is assigned to this job yet.";

  // ── fund_escrow ──────────────────────────────────────────────────────────
  if (action === "fund") {
    if (msg === "Only job client or admin can fund escrow")
      return "Only the client who posted this job can fund escrow.";
    if (msg === "Milestone must be in pending state")
      return "This milestone is not in the pending state and cannot be funded.";
    if (msg === "Insufficient available balance")
      return "Not enough balance in your wallet to fund this milestone.";
  }

  // ── submit_milestone ─────────────────────────────────────────────────────
  if (action === "submit") {
    if (msg === "Only assigned worker or admin can submit milestone")
      return "Only the assigned worker can submit this milestone.";
    // 'Milestone must be funded to submit (current: ...)' — starts-with match
    if (msg.startsWith("Milestone must be funded to submit"))
      return "This milestone must be funded before it can be submitted.";
  }

  // ── approve_milestone ────────────────────────────────────────────────────
  if (action === "approve") {
    if (msg === "Only job client or admin can approve milestone")
      return "Only the client who posted this job can approve milestones.";
    if (msg === "Milestone must be funded/submitted/approved")
      return "This milestone is not in a state that allows approval.";
    if (msg === "Insufficient locked balance")
      return "Locked escrow balance is insufficient to release payment.";
  }

  // ── dispute_milestone ────────────────────────────────────────────────────
  if (action === "dispute") {
    if (msg === "Reason is required") return "A reason is required to raise a dispute.";
    if (msg === "Only job participants or admin can raise dispute")
      return "Only the client or worker on this job can raise a dispute.";
    if (msg === "Cannot dispute released/refunded milestone")
      return "This milestone has already been settled and cannot be disputed.";
  }

  return null;
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
    const { milestone_id } = parsed.data;

    // TODO: Phase 5 — proof upload before submitting
    const { data, error } = await supabase.rpc("submit_milestone", {
      p_milestone_id: milestone_id,
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
    const { milestone_id } = parsed.data;

    const { data, error } = await supabase.rpc("approve_milestone", {
      p_milestone_id: milestone_id,
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
    const { milestone_id, reason } = parsed.data;

    const { data, error } = await supabase.rpc("dispute_milestone", {
      p_milestone_id: milestone_id,
      p_reason: reason,
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
