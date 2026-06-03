import { describe, it, expect } from "vitest";
import { mapEscrowRpcError } from "@/lib/rpc-errors";
import type { PostgrestError } from "@supabase/supabase-js";

function mockError(code: string, message: string): PostgrestError {
  return { code, message, details: "", hint: "" } as PostgrestError;
}

describe("mapEscrowRpcError", () => {
  describe("Token parsing (A & C)", () => {
    it("preserves specific authz messages (forbidden_role)", () => {
      const err = mockError("42501", "pakka:forbidden_role: Withdrawals are restricted");
      expect(mapEscrowRpcError("withdraw", err)).toBe("Withdrawals are restricted to worker accounts.");
    });

    it("differentiates not_authorized by action context", () => {
      const err = mockError("42501", "pakka:not_authorized: xyz");
      expect(mapEscrowRpcError("fund", err)).toBe("Only the client who posted this job can fund escrow.");
      expect(mapEscrowRpcError("submit", err)).toBe("Only the assigned worker can submit this milestone.");
      expect(mapEscrowRpcError("approve", err)).toBe("Only the client who posted this job can approve milestones.");
      expect(mapEscrowRpcError("dispute", err)).toBe("Only the client or worker on this job can raise a dispute.");
    });

    it("differentiates invalid_status_transition by action context", () => {
      const err = mockError("P0001", "pakka:invalid_status_transition: msg");
      expect(mapEscrowRpcError("fund", err)).toBe("This milestone is not in the pending state and cannot be funded.");
      expect(mapEscrowRpcError("submit", err)).toBe("This milestone must be funded before it can be submitted.");
      expect(mapEscrowRpcError("approve", err)).toBe("This milestone is not in a state that allows approval.");
    });

    it("differentiates insufficient_balance by action context", () => {
      const err = mockError("P0001", "pakka:insufficient_balance: msg");
      expect(mapEscrowRpcError("fund", err)).toBe("Not enough balance in your wallet to fund this milestone.");
      expect(mapEscrowRpcError("approve", err)).toBe("Locked escrow balance is insufficient to release payment.");
      expect(mapEscrowRpcError("withdraw", err)).toBe("Not enough balance in your wallet.");
    });

    it("handles complex strings with parens/% in the suffix", () => {
      const err = mockError("P0001", "pakka:invalid_status_transition: Milestone must be funded to submit (current: pending)");
      expect(mapEscrowRpcError("submit", err)).toBe("This milestone must be funded before it can be submitted.");
    });
  });

  describe("Fallback tests", () => {
    it("falls back to exact match for old un-tokenized errors", () => {
      const err = mockError("22000", "Milestone not found");
      expect(mapEscrowRpcError("fund", err)).toBe("Milestone not found.");
      expect(mapEscrowRpcError("submit", err)).toBe("Milestone not found.");
      expect(mapEscrowRpcError("approve", err)).toBe("Milestone not found.");
    });

    it("falls back for wallet errors via error code + message", () => {
      const err = mockError("22023", "invalid_amount");
      expect(mapEscrowRpcError("topup", err)).toBe("Amount must be between ₹100 and ₹1,00,000.");
      expect(mapEscrowRpcError("withdraw", err)).toBe("Amount must be between ₹100 and ₹5,00,000.");
    });
  });
});
