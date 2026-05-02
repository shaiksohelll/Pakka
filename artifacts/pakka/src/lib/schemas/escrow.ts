import { z } from "zod";

// ── Fund milestone ──────────────────────────────────────────────────────────
export const fundMilestoneSchema = z.object({
  milestone_id: z.string().uuid("Invalid milestone ID"),
  idempotency_key: z.string().uuid("Invalid idempotency key"),
});

export type FundMilestoneInput = z.infer<typeof fundMilestoneSchema>;

// ── Submit milestone (worker) ───────────────────────────────────────────────
export const submitMilestoneSchema = z.object({
  milestone_id: z.string().uuid("Invalid milestone ID"),
  idempotency_key: z.string().uuid("Invalid idempotency key"),
});

export type SubmitMilestoneInput = z.infer<typeof submitMilestoneSchema>;

// ── Approve milestone ───────────────────────────────────────────────────────
export const approveMilestoneSchema = z.object({
  milestone_id: z.string().uuid("Invalid milestone ID"),
  idempotency_key: z.string().uuid("Invalid idempotency key"),
});

export type ApproveMilestoneInput = z.infer<typeof approveMilestoneSchema>;

// ── Dispute milestone ───────────────────────────────────────────────────────
export const disputeMilestoneSchema = z.object({
  milestone_id: z.string().uuid("Invalid milestone ID"),
  reason: z
    .string()
    .trim()
    .min(10, "Reason must be at least 10 characters")
    .max(1000, "Reason must be at most 1000 characters"),
  idempotency_key: z.string().uuid("Invalid idempotency key"),
});

export type DisputeMilestoneInput = z.infer<typeof disputeMilestoneSchema>;
