import { supabase } from "@/lib/supabase";
import type { WalletTxn } from "@/lib/types/database";

export async function fundMilestone(
  milestoneId: string,
  clientId: string,
  amount: number
): Promise<void> {
  const { error: mErr } = await supabase
    .from("milestones")
    .update({ status: "funded" })
    .eq("id", milestoneId);
  if (mErr) throw new Error(mErr.message);

  const { error: txnErr } = await supabase.from("wallet_txns").insert({
    user_id: clientId,
    type: "hold",
    amount,
    ref_id: milestoneId,
    ref_type: "milestone",
    description: "Escrow hold for milestone",
  });
  if (txnErr) throw new Error(txnErr.message);
}

export async function releaseMilestone(
  milestoneId: string,
  workerId: string,
  amount: number
): Promise<void> {
  const { error: mErr } = await supabase
    .from("milestones")
    .update({ status: "released", paid_at: new Date().toISOString() })
    .eq("id", milestoneId);
  if (mErr) throw new Error(mErr.message);

  const { error: txnErr } = await supabase.from("wallet_txns").insert({
    user_id: workerId,
    type: "credit",
    amount,
    ref_id: milestoneId,
    ref_type: "milestone",
    description: "Milestone payment received",
  });
  if (txnErr) throw new Error(txnErr.message);
}

export async function raiseDispute(milestoneId: string): Promise<void> {
  const { error } = await supabase
    .from("milestones")
    .update({ status: "disputed" })
    .eq("id", milestoneId);
  if (error) throw new Error(error.message);
}

export async function getWalletTxns(userId: string): Promise<WalletTxn[]> {
  const { data, error } = await supabase
    .from("wallet_txns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as WalletTxn[];
}
