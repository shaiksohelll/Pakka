"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { topupWalletSchema, type TopupWalletInput } from "@/lib/schemas/wallet";
import type { ActionResult } from "./escrow";

// ── Helper ────────────────────────────────────────────────────────────────────
async function getAuthUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Not authenticated");
  return { supabase, userId: user.id };
}

// ── Top up Wallet ─────────────────────────────────────────────────────────────
// external → wallet: calls topup_wallet() SECURITY DEFINER function (test mode)
export async function topupWalletAction(
  raw: TopupWalletInput,
): Promise<ActionResult<{ availableBalance: number; ledgerId: string }>> {
  try {
    const parsed = topupWalletSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();
    const { amount, idempotency_key } = parsed.data;

    const { data, error } = await supabase.rpc("topup_wallet", {
      p_amount: amount,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid_amount")) {
        return { success: false, error: "Amount must be between ₹100 and ₹1,00,000." };
      }
      if (msg.includes("not_authenticated")) {
        return { success: false, error: "You need to be signed in." };
      }
      return { success: false, error: "Could not top up wallet. Please try again." };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { success: false, error: "Could not top up wallet. Please try again." };
    }

    revalidatePath("/client/wallet", "layout");
    revalidatePath("/worker/wallet", "layout");

    return {
      success: true,
      data: {
        availableBalance: Number(row.available_balance),
        ledgerId: row.ledger_id as string,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // TODO: Sentry.captureException(err);
    return { success: false, error: msg };
  }
}
