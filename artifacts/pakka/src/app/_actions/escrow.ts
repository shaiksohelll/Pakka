import { createClient } from "@/lib/supabase/client";
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

async function getAuthUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Not authenticated");
  return { supabase, userId: user.id };
}

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

    const { data, error } = await supabase.rpc("fund_escrow", {
      p_milestone_id: milestone_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

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

    const { data, error } = await supabase.rpc("submit_milestone", {
      p_milestone_id: milestone_id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { milestoneId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

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

    return { success: true, data: { ledgerId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

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

    return { success: true, data: { disputeId: data as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
