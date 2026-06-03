"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import {
  topupWalletSchema,
  type TopupWalletInput,
  withdrawWalletSchema,
  type WithdrawWalletInput,
} from "@/lib/schemas/wallet";
import { type ActionResult } from "./escrow";
import { mapEscrowRpcError } from "@/lib/rpc-errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      const friendly = mapEscrowRpcError("topup", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[wallet.topupWalletAction] Unmapped RPC error", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      // TODO: Sentry.captureException(error);
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
    console.error("[wallet.topupWalletAction] Unexpected error", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not top up wallet. Please try again." };
  }
}


// ── Withdraw Wallet ───────────────────────────────────────────────────────────
// wallet → external: calls withdraw_wallet() SECURITY DEFINER function (test mode)

export async function withdrawWalletAction(
  raw: WithdrawWalletInput,
): Promise<ActionResult<{ availableBalance: number; ledgerId: string }>> {
  try {
    const parsed = withdrawWalletSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { supabase } = await getAuthUserId();

    // Defense-in-depth: explicit worker-role pre-check. The DB layer also
    // enforces this inside withdraw_wallet via
    //   `if not public.is_worker() then raise exception 'forbidden_role' ...`
    // (PR #19 review: addresses missing role check at action layer.)
    const { data: isWorker, error: roleErr } = await supabase.rpc("is_worker");
    if (roleErr) {
      console.error("[wallet.withdrawWalletAction] is_worker check failed", {
        code: roleErr.code,
        message: roleErr.message,
        details: roleErr.details,
      });
      return { success: false, error: "Could not verify account role. Please try again." };
    }
    if (!isWorker) {
      return { success: false, error: "Withdrawals are restricted to worker accounts." };
    }

    const { amount, idempotency_key } = parsed.data;
    const { data, error } = await supabase.rpc("withdraw_wallet", {
      p_amount: amount,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const friendly = mapEscrowRpcError("withdraw", error);
      if (friendly) return { success: false, error: friendly };
      console.error("[wallet.withdrawWalletAction] Unmapped RPC error", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      // TODO: Sentry.captureException(error);
      return { success: false, error: "Could not withdraw from wallet. Please try again." };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { success: false, error: "Could not withdraw from wallet. Please try again." };
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
    console.error("[wallet.withdrawWalletAction] Unexpected error", err);
    // TODO: Sentry.captureException(err);
    return { success: false, error: "Could not withdraw from wallet. Please try again." };
  }
}
