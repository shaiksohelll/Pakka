"use server";

import { phoneSchema, otpSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

export async function requestOtpAction(input: { phone: string }): Promise<AuthActionResult> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid phone number." };
  }

  const phone = `+91${parsed.data.phone}`;
  const redirectTo = `/login/verify?phone=${parsed.data.phone}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, redirectTo };
}

export async function resendOtpAction(input: { phone: string }): Promise<AuthActionResult> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid phone number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: `+91${parsed.data.phone}`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function verifyOtpAction(input: {
  phone: string;
  otp: string;
}): Promise<AuthActionResult> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid OTP." };
  }

  const supabase = await createClient();
  const phone = `+91${parsed.data.phone}`;

  const { error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token: parsed.data.otp,
    type: "sms",
  });

  if (verifyError) {
    return { success: false, error: verifyError.message };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: userError?.message ?? "Unable to fetch signed-in user." };
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .limit(1);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const profile =
    ((profileRows as unknown as Array<{ role: "client" | "worker" | "admin" }> | null) ?? [])[0] ??
    null;

  if (!profile) {
    return { success: true, redirectTo: "/onboarding/role" };
  }

  const role = (profile as { role?: "client" | "worker" | "admin" } | null)?.role;

  if (role === "client") {
    return { success: true, redirectTo: "/client" };
  }

  if (role === "admin") {
    return { success: true, redirectTo: "/admin" };
  }

  if (role === "worker") {
    return { success: true, redirectTo: "/worker/feed" };
  }

  return { success: true, redirectTo: "/" };
}
