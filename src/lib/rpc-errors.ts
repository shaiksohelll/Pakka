import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Map a Postgres RPC error into a user-friendly string. Routes by the parsed
 * `pakka:<token>:` prefix first, then falls back to exact-string matching for
 * transitional compatibility during deployment.
 */
export function mapEscrowRpcError(
  action: "fund" | "submit" | "approve" | "dispute" | "withdraw" | "topup",
  error: PostgrestError,
): string | null {
  const msg = error.message ?? "";

  // ── 1. Structured Token Matching ───────────────────────────────────────────
  const match = msg.match(/^pakka:([a-z_]+):\s*(.*)$/);
  if (match) {
    const token = match[1];
    
    switch (token) {
      case "not_authenticated": return "You need to be signed in.";
      
      case "not_authorized":
        if (action === "fund") return "Only the client who posted this job can fund escrow.";
        if (action === "submit") return "Only the assigned worker can submit this milestone.";
        if (action === "approve") return "Only the client who posted this job can approve milestones.";
        if (action === "dispute") return "Only the client or worker on this job can raise a dispute.";
        return "You don't have permission for this operation.";
        
      case "forbidden_role":
        if (action === "withdraw") return "Withdrawals are restricted to worker accounts.";
        return "You don't have permission for this operation.";
        
      case "invalid_idempotency_key": return "Request signature missing. Please refresh and try again.";
      case "milestone_not_found": return "Milestone not found.";
      case "worker_not_assigned": return "No worker is assigned to this job yet.";
      
      case "invalid_status_transition":
        if (action === "fund") return "This milestone is not in the pending state and cannot be funded.";
        if (action === "submit") return "This milestone must be funded before it can be submitted.";
        if (action === "approve") return "This milestone is not in a state that allows approval.";
        return "Invalid milestone state.";
        
      case "insufficient_balance":
        if (action === "fund") return "Not enough balance in your wallet to fund this milestone.";
        if (action === "approve") return "Locked escrow balance is insufficient to release payment.";
        if (action === "withdraw") return "Not enough balance in your wallet.";
        return "Insufficient balance.";
        
      case "invalid_amount":
        if (action === "topup") return "Amount must be between ₹100 and ₹1,00,000.";
        if (action === "withdraw") return "Amount must be between ₹100 and ₹5,00,000.";
        return "Invalid transaction amount.";
        
      case "wallet_not_found": return "Wallet not found. Please contact support.";
      case "reason_required": return "A reason is required to raise a dispute.";
      case "cannot_dispute_settled": return "This milestone has already been settled and cannot be disputed.";
    }
  }

  // ── 2. TRANSITIONAL: Exact String Fallback ───────────────────────────────
  // TODO: Remove after new migration and Next.js app are both deployed

  // Shared
  if (msg === "Milestone not found") return "Milestone not found.";
  if (msg === "Job has no assigned worker") return "No worker is assigned to this job yet.";
  if (msg === "invalid_idempotency_key") return "Request signature missing. Please refresh and try again.";

  // fund_escrow
  if (action === "fund") {
    if (msg === "Only job client or admin can fund escrow") return "Only the client who posted this job can fund escrow.";
    if (msg === "Milestone must be in pending state") return "This milestone is not in the pending state and cannot be funded.";
    if (msg === "Insufficient available balance") return "Not enough balance in your wallet to fund this milestone.";
  }

  // submit_milestone
  if (action === "submit") {
    if (msg === "Only assigned worker or admin can submit milestone") return "Only the assigned worker can submit this milestone.";
    if (msg.startsWith("Milestone must be funded to submit")) return "This milestone must be funded before it can be submitted.";
  }

  // approve_milestone
  if (action === "approve") {
    if (msg === "Only job client or admin can approve milestone") return "Only the client who posted this job can approve milestones.";
    if (msg === "Milestone must be funded or submitted") return "This milestone is not in a state that allows approval.";
    if (msg === "Insufficient locked balance") return "Locked escrow balance is insufficient to release payment.";
  }

  // dispute_milestone
  if (action === "dispute") {
    if (msg === "Reason is required") return "A reason is required to raise a dispute.";
    if (msg === "Only job participants or admin can raise dispute") return "Only the client or worker on this job can raise a dispute.";
    if (msg === "Cannot dispute released/refunded milestone") return "This milestone has already been settled and cannot be disputed.";
  }

  // withdraw_wallet / topup_wallet
  if (error.code === "42501") {
    if (msg === "not_authenticated") return "You need to be signed in.";
    if (msg === "forbidden_role") return action === "withdraw" ? "Withdrawals are restricted to worker accounts." : "You don't have permission for this operation.";
  }
  if (error.code === "22023") {
    if (msg === "invalid_amount") return action === "topup" ? "Amount must be between ₹100 and ₹1,00,000." : "Amount must be between ₹100 and ₹5,00,000.";
    if (msg === "insufficient_balance") return "Not enough balance in your wallet.";
    if (msg === "wallet_not_found") return "Wallet not found. Please contact support.";
  }

  return null;
}
