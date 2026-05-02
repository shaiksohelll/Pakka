import { z } from "zod";

export const workerCategories = [
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

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadhaarRegex = /^\d{12}$/;

const multiplicationTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

const permutationTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

function isValidVerhoeff(input: string) {
  let checksum = 0;
  const reversed = input.split("").reverse();

  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number.parseInt(reversed[i], 10);
    checksum = multiplicationTable[checksum][permutationTable[i % 8][digit]];
  }

  return checksum === 0;
}

export const roleSchema = z.object({
  role: z.enum(["client", "worker"]),
});

export const clientOnboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required."),
  city: z.string().trim().min(2, "City is required."),
});

export const workerOnboardingSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name is required."),
    aadhaar: z
      .string()
      .trim()
      .regex(aadhaarRegex, "Aadhaar must be exactly 12 digits.")
      .refine((value) => isValidVerhoeff(value), "Invalid Aadhaar checksum."),
    aadhaarLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter last 4 digits."),
    pan: z.string().trim().toUpperCase().regex(panRegex, "Invalid PAN format."),
    panLast4: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9A-Z]{4}$/, "Enter PAN last 4."),
    selfie: z.any()
      .refine((v) => typeof window === "undefined" || v instanceof File, "Selfie required")
      .refine((v) => typeof window === "undefined" || (v instanceof File && v.size < 5_000_000), "Max 5MB"),
    categories: z
      .array(z.enum(workerCategories))
      .min(1, "Select at least one category.")
      .max(3, "You can select up to 3 categories."),
    skillTags: z
      .array(z.string().trim().min(1))
      .max(8, "You can add up to 8 skill tags.")
      .default([]),
  })
  .refine((value) => value.aadhaar.slice(-4) === value.aadhaarLast4, {
    path: ["aadhaarLast4"],
    message: "Last 4 digits do not match Aadhaar.",
  })
  .refine((value) => value.pan.slice(-4) === value.panLast4, {
    path: ["panLast4"],
    message: "Last 4 characters do not match PAN.",
  });

export type RoleInput = z.infer<typeof roleSchema>;
export type ClientOnboardingInput = z.infer<typeof clientOnboardingSchema>;
export type WorkerOnboardingInput = z.input<typeof workerOnboardingSchema>;
