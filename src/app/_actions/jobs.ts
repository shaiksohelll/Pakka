"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  postJobSchema,
  applyJobSchema,
  acceptWorkerSchema,
  type PostJobInput,
  type ApplyJobInput,
  type AcceptWorkerInput,
} from "@/lib/schemas/jobs";

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

// ── Post a job ────────────────────────────────────────────────────────────────
export async function postJobAction(raw: PostJobInput): Promise<ActionResult<{ jobId: string }>> {
  try {
    const parsed = postJobSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid job data",
      };
    }

    const { supabase, userId } = await getAuthUserId();
    const {
      title,
      category,
      description,
      location_text,
      lat,
      lng,
      total_budget,
      milestones,
      materials,
    } = parsed.data;

    // Insert job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        client_id: userId,
        title,
        category,
        description,
        location_text,
        lat: lat ?? null,
        lng: lng ?? null,
        total_budget,
        status: "open",
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return { success: false, error: jobError?.message ?? "Failed to create job" };
    }

    // Insert milestones
    const { error: msError } = await supabase.from("milestones").insert(
      milestones.map((m, i) => ({
        job_id: job.id,
        sequence: i + 1,
        title: m.title,
        description: m.description ?? null,
        amount: m.amount,
        status: "pending" as const,
      })),
    );

    if (msError) {
      return { success: false, error: msError.message };
    }

    // Insert materials (optional)
    if (materials && materials.length > 0) {
      const { error: matError } = await supabase.from("materials").insert(
        materials.map((mat) => ({
          job_id: job.id,
          vendor_name: mat.vendor_name,
          item_name: mat.item_name,
          qty: mat.qty,
          amount: mat.amount,
          status: "requested" as const,
        })),
      );
      if (matError) {
        return { success: false, error: matError.message };
      }
    }

    revalidatePath("/client/jobs");
    return { success: true, data: { jobId: job.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Sentry.captureException(err);
    return { success: false, error: msg };
  }
}

// ── Apply to job ──────────────────────────────────────────────────────────────
export async function applyToJobAction(raw: ApplyJobInput): Promise<ActionResult> {
  try {
    const parsed = applyJobSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid application data",
      };
    }

    const { supabase, userId } = await getAuthUserId();
    const { job_id, bid_amount, eta_days, message } = parsed.data;

    const { error } = await supabase.from("job_applications").insert({
      job_id,
      worker_id: userId,
      bid_amount,
      eta_days,
      message: message ?? null,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "You have already applied to this job." };
      }

      const message = error.message.toLowerCase();
      const isPolicyError =
        error.code === "42501" ||
        message.includes("row-level security") ||
        message.includes("violates row-level security");

      if (isPolicyError) {
        return {
          success: false,
          error: "You can't apply to this job. It may be closed or posted by your account.",
        };
      }

      return { success: false, error: "Could not send application. Please try again." };
    }

    revalidatePath(`/worker/jobs/${job_id}`);
    revalidatePath("/worker/applications");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Sentry.captureException(err);
    return { success: false, error: msg };
  }
}

// ── Accept worker ─────────────────────────────────────────────────────────────
export async function acceptWorkerAction(raw: AcceptWorkerInput): Promise<ActionResult> {
  try {
    const parsed = acceptWorkerSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    const { supabase, userId } = await getAuthUserId();
    const { job_id, application_id } = parsed.data;

    // Verify this user is the client
    const { data: job, error: jobFetchError } = await supabase
      .from("jobs")
      .select("id, client_id, status")
      .eq("id", job_id)
      .single();

    if (jobFetchError || !job) {
      return { success: false, error: "Job not found" };
    }
    if (job.client_id !== userId) {
      return { success: false, error: "Not authorised" };
    }
    if (job.status !== "open") {
      return { success: false, error: "Job is no longer open" };
    }

    // Get the accepted application's worker_id
    const { data: acceptedApp, error: appFetchError } = await supabase
      .from("job_applications")
      .select("worker_id")
      .eq("id", application_id)
      .eq("job_id", job_id)
      .single();

    if (appFetchError || !acceptedApp) {
      return { success: false, error: "Application not found" };
    }

    // Atomically: update job + set accepted application + reject others
    const [jobUpdate, acceptUpdate, rejectUpdate] = await Promise.all([
      supabase
        .from("jobs")
        .update({
          worker_id: acceptedApp.worker_id,
          status: "assigned",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", job_id)
        .eq("client_id", userId),

      supabase.from("job_applications").update({ status: "accepted" }).eq("id", application_id),

      supabase
        .from("job_applications")
        .update({ status: "rejected" })
        .eq("job_id", job_id)
        .neq("id", application_id),
    ]);

    const errors = [jobUpdate.error, acceptUpdate.error, rejectUpdate.error].filter(Boolean);
    if (errors.length > 0) {
      return { success: false, error: errors[0]!.message };
    }

    revalidatePath(`/client/jobs/${job_id}`);
    revalidatePath("/client/jobs");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Sentry.captureException(err);
    return { success: false, error: msg };
  }
}
