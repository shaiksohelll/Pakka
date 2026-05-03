import { z } from "zod";

export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91\d{10}$/, "Enter a valid +91 mobile number (e.g. +919876543210)"),
});

export const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
});
