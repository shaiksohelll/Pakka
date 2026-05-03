import { z } from "zod";

export const CATEGORIES = [
  "plumbing",
  "electrical",
  "carpentry",
  "painting",
  "cleaning",
  "delivery",
  "moving",
  "gardening",
  "tutoring",
  "cooking",
  "driving",
  "security",
  "other",
] as const;

export const jobSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  category: z.enum(CATEGORIES, { required_error: "Select a category" }),
  budget: z.coerce.number({ required_error: "Enter a budget" }).min(100, "Minimum budget is ₹100"),
  city: z.string().min(1, "Select a city"),
  area: z.string().min(1, "Enter or select an area"),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export type JobFormValues = z.infer<typeof jobSchema>;

export const milestoneSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  due_date: z.string().optional(),
});

export type MilestoneFormValues = z.infer<typeof milestoneSchema>;
