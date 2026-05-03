import { z } from "zod";

export const clientOnboardingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const workerOnboardingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  aadhaar_last4: z
    .string()
    .length(4, "Enter exactly the last 4 digits of your Aadhaar")
    .regex(/^\d{4}$/, "Must be 4 numeric digits"),
});
