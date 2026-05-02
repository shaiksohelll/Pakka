import {
  clientOnboardingSchema,
  roleSchema,
  workerOnboardingSchema,
} from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/client";

export type OnboardingActionResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

async function getSignedInUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null, error: error?.message ?? "You are not signed in." };
  }

  return { supabase, userId: user.id, error: null };
}

export async function selectRoleAction(input: {
  role: "client" | "worker";
}): Promise<OnboardingActionResult> {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid role selection." };
  }

  const { supabase, userId, error } = await getSignedInUserId();
  if (!userId || error) {
    return { success: false, error: error ?? "You are not signed in." };
  }

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: parsed.data.role,
      full_name: "Pakka User",
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  return {
    success: true,
    redirectTo: parsed.data.role === "client" ? "/onboarding/client" : "/onboarding/worker",
  };
}

export async function completeClientOnboardingAction(input: {
  fullName: string;
  city: string;
}): Promise<OnboardingActionResult> {
  const parsed = clientOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid form values." };
  }

  const { supabase, userId, error } = await getSignedInUserId();
  if (!userId || error) {
    return { success: false, error: error ?? "You are not signed in." };
  }

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: "client",
      full_name: parsed.data.fullName,
      city: parsed.data.city,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  return { success: true, redirectTo: "/client" };
}

export async function completeWorkerOnboardingAction(
  formData: FormData,
): Promise<OnboardingActionResult> {
  const payload = {
    fullName: String(formData.get("fullName") ?? ""),
    aadhaar: String(formData.get("aadhaar") ?? ""),
    aadhaarLast4: String(formData.get("aadhaarLast4") ?? ""),
    pan: String(formData.get("pan") ?? "").toUpperCase(),
    panLast4: String(formData.get("panLast4") ?? "").toUpperCase(),
    categories: formData.getAll("categories").map((value) => String(value)),
    skillTags: formData
      .getAll("skillTags")
      .map((value) => String(value).trim())
      .filter(Boolean),
  };

  const selfie = formData.get("selfie");

  const parsed = workerOnboardingSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid worker details." };
  }

  if (!(selfie instanceof File) || selfie.size === 0) {
    return { success: false, error: "A selfie image is required." };
  }

  const { supabase, userId, error } = await getSignedInUserId();
  if (!userId || error) {
    return { success: false, error: error ?? "You are not signed in." };
  }

  const selfiePath = `${userId}/selfie-${Date.now()}.jpg`;
  const selfieBuffer = await selfie.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from("kyc").upload(selfiePath, selfieBuffer, {
    contentType: selfie.type || "image/jpeg",
    upsert: false,
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: "worker",
      full_name: parsed.data.fullName,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const { error: workerError } = await supabase.from("worker_profiles").upsert(
    {
      profile_id: userId,
      kyc_status: "pending",
      aadhaar_last4: parsed.data.aadhaar.slice(-4),
      pan_last4: parsed.data.pan.slice(-4),
      selfie_url: selfiePath,
      categories: parsed.data.categories,
      skill_tags: parsed.data.skillTags,
    },
    { onConflict: "profile_id" },
  );

  if (workerError) {
    return { success: false, error: workerError.message };
  }

  return { success: true, redirectTo: "/worker/kyc-pending" };
}
