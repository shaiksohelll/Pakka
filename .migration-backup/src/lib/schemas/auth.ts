import { z } from "zod";

export const indianPhoneRegex = /^[6-9]\d{9}$/;
export const otpRegex = /^\d{6}$/;

export const phoneSchema = z.object({
  phone: z.string().trim().regex(indianPhoneRegex, "Enter a valid 10-digit Indian mobile number."),
});

export const otpSchema = z.object({
  phone: z.string().trim().regex(indianPhoneRegex, "Invalid phone number."),
  otp: z.string().regex(otpRegex, "Enter the 6-digit OTP."),
});

export type PhoneInput = z.infer<typeof phoneSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
