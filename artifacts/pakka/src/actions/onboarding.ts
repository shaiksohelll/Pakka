import { supabase } from "@/lib/supabase";

export async function completeClientOnboarding(
  userId: string,
  name: string
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    name,
    role: "client",
    onboarding_done: true,
  });
  if (error) throw new Error(error.message);
}

export async function completeWorkerOnboarding(
  userId: string,
  name: string,
  aadhaar_last4: string,
  selfieFile?: File
): Promise<void> {
  let selfie_url: string | null = null;

  if (selfieFile) {
    const { error: uploadErr } = await supabase.storage
      .from("kyc")
      .upload(`${userId}/selfie.jpg`, selfieFile, { upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: urlData } = supabase.storage
      .from("kyc")
      .getPublicUrl(`${userId}/selfie.jpg`);
    selfie_url = urlData.publicUrl;
  }

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    name,
    role: "worker",
    aadhaar_last4,
    selfie_url,
    kyc_status: "pending",
    onboarding_done: true,
    trust_tier: "bronze",
  });
  if (error) throw new Error(error.message);
}
