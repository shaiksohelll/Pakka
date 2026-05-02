import { z } from "zod";

export const JOB_CATEGORIES = [
  "masonry",
  "plumbing",
  "electrical",
  "painting",
  "carpentry",
  "tiling",
  "welding",
  "ac-repair",
  "appliance-repair",
  "cleaning",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  masonry: "Masonry",
  plumbing: "Plumbing",
  electrical: "Electrical",
  painting: "Painting",
  carpentry: "Carpentry",
  tiling: "Tiling",
  welding: "Welding",
  "ac-repair": "AC Repair",
  "appliance-repair": "Appliance Repair",
  cleaning: "Cleaning",
};

// ── Milestone sub-schema ─────────────────────────────────────────────────────
export const milestoneSchema = z.object({
  title: z.string().trim().min(3, "Min 3 chars").max(60, "Max 60 chars"),
  description: z.string().trim().max(500, "Max 500 chars").optional(),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Must be positive"),
});

export type MilestoneInput = z.infer<typeof milestoneSchema>;

// ── Material sub-schema ──────────────────────────────────────────────────────
export const materialSchema = z.object({
  vendor_name: z.string().trim().min(1, "Required"),
  item_name: z.string().trim().min(1, "Required"),
  qty: z
    .number({ message: "Qty required" })
    .positive("Must be > 0"),
  amount: z
    .number({ message: "Amount required" })
    .nonnegative("Must be ≥ 0"),
});

export type MaterialInput = z.infer<typeof materialSchema>;

// ── Post job (multi-step) ────────────────────────────────────────────────────
export const postJobSchema = z
  .object({
    title: z.string().trim().min(3, "Min 3 chars").max(80, "Max 80 chars"),
    category: z.enum(JOB_CATEGORIES, {
      message: "Select a category"
    }),
    description: z
      .string()
      .trim()
      .min(20, "Min 20 chars")
      .max(2000, "Max 2000 chars"),
    location_text: z.string().trim().min(2, "Enter city/area"),
    lat: z.number().optional(),
    lng: z.number().optional(),
    total_budget: z
      .number({ message: "Budget is required" })
      .min(500, "Minimum ₹500")
      .max(500000, "Maximum ₹5,00,000"),
    milestones: z
      .array(milestoneSchema)
      .min(1, "At least 1 milestone")
      .max(8, "Max 8 milestones"),
    materials: z.array(materialSchema).optional(),
  })
  .refine(
    (data) => {
      const sum = data.milestones.reduce((acc, m) => acc + (m.amount ?? 0), 0);
      return Math.abs(sum - data.total_budget) < 1;
    },
    {
      path: ["milestones"],
      message: "Milestone amounts must sum to total budget",
    },
  );

export type PostJobInput = z.infer<typeof postJobSchema>;

// ── Apply to job ─────────────────────────────────────────────────────────────
export const applyJobSchema = z.object({
  job_id: z.string().uuid(),
  total_budget: z.number().positive(),
  bid_amount: z
    .number({ message: "Bid amount required" })
    .positive("Must be positive"),
  eta_days: z
    .number({ message: "ETA required" })
    .int()
    .min(1, "Min 1 day")
    .max(60, "Max 60 days"),
  message: z.string().trim().max(500, "Max 500 chars").optional(),
});

export type ApplyJobInput = z.infer<typeof applyJobSchema>;

// Client-side form schema (bid_amount validated against budget ±20%)
export const applyJobFormSchema = applyJobSchema.superRefine((data, ctx) => {
  const budget = data.total_budget;
  const lower = budget * 0.8;
  const upper = budget * 1.2;
  if (data.bid_amount < lower || data.bid_amount > upper) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bid_amount"],
      message: `Bid must be within ±20% of budget (₹${Math.round(lower)}–₹${Math.round(upper)})`,
    });
  }
});

export type ApplyJobFormInput = z.infer<typeof applyJobFormSchema>;

// ── Accept worker ────────────────────────────────────────────────────────────
export const acceptWorkerSchema = z.object({
  job_id: z.string().uuid(),
  application_id: z.string().uuid(),
});

export type AcceptWorkerInput = z.infer<typeof acceptWorkerSchema>;
