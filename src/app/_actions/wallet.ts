"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  topupWalletSchema,
  type TopupWalletInput,
  withdrawWalletSchema,
  type WithdrawWalletInput,
} from "@/lib/schemas/wallet";
import type { ActionResult } from "./escrow";

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

/**
 * Map a Postgres RPC error from topup_wallet / withdraw_wallet into a
 * user-friendly string. Routes by SQLSTATE first (error.code), then by the
 * exact exception token from RAISE EXCEPTION (error.message).
 *
 * Returns null when the error is unrecognised; callers should log raw +
 * fall back to a generic message.
 *
 * Replaces the previous error.message substring matching (PR #19 review,
 * CodeRabbit #1) with a deterministic SQLSTATE + exact-token dispatch.
 */
function mapWalletRpcError(
  action: "topup" | "withdraw",
  error: { code: string; message: string },
): string | null {
  // 42501 — insufficient privilege / auth-related
  if (error.code === "42501") {
    if (error.message === "not_authenticated") return "You need to be signed in.";
    if (error.message === "forbidden_role") {
      return action === "withdraw"
        ? "Withdrawals are restricted to worker accounts."
        : "You don't have permission for this operation.";
    }
    return "You don't have permission for this operation.";
  }
  // 22023 — invalid parameter value
  if (error.code === "22023") {
    if (error.message === "invalid_amount") {
      return action === "topup"
        ? "Amount must be between ₹100 and ₹1,00,000."
        : "Amount must be at least ₹100.";
    }
    if (error.message === "invalid_idempotency_key") {
      return "Request signature missing. Please refresh and try again.";
    }
    if (error.message === "insufficient_balance") return "Not enough balance in your wallet.";
    if (error.message === "wallet_not_found") return "Wallet not found. Please contact support.";
    return "Invalid input. Please check the amount and try again.";
  }
  return null;
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
      const friendly = mapWalletRpcError("topup", error);
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
    // (PR #19 review, CodeAnt #1: addresses missing role check at action layer.)
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
      const friendly = mapWalletRpcError("withdraw", error);
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
