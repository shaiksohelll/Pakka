import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  createState,
  resetIdCounter,
  fundMilestone,
  submitMilestone,
  approveMilestone,
  disputeMilestone,
  adminRefund,
  adminForceRelease,
  verifyConservation,
  type EscrowState,
} from "@/lib/escrow-machine";

const CLIENT = "client-prop";
const WORKER = "worker-prop";

// ── Action types for the property test ────────────────────────────────────────
type Action =
  | { type: "fund"; msIndex: number }
  | { type: "submit"; msIndex: number }
  | { type: "approve"; msIndex: number }
  | { type: "dispute"; msIndex: number }
  | { type: "admin_refund"; msIndex: number }
  | { type: "admin_force_release"; msIndex: number };

/**
 * Apply an action to the state. Silently ignores invalid transitions
 * (the real DB would throw an error, but for property testing we want
 * to generate random sequences and verify the invariant holds regardless).
 */
function applyAction(state: EscrowState, action: Action): void {
  const msId = `ms-${action.msIndex + 1}`;
  try {
    switch (action.type) {
      case "fund":
        fundMilestone(state, msId, CLIENT);
        break;
      case "submit":
        submitMilestone(state, msId);
        break;
      case "approve":
        approveMilestone(state, msId, CLIENT, WORKER);
        break;
      case "dispute":
        disputeMilestone(state, msId);
        break;
      case "admin_refund":
        adminRefund(state, msId, CLIENT);
        break;
      case "admin_force_release":
        adminForceRelease(state, msId, CLIENT, WORKER);
        break;
    }
  } catch {
    // Invalid transition — skip silently
  }
}

/**
 * Verify the zero-sum invariant:
 * For every wallet W:
 *   sum(escrow_ledger.amount where to_wallet=W) - sum(escrow_ledger.amount where from_wallet=W)
 *   === net change in wallet[W].available + wallet[W].locked
 *
 * And total money is conserved across the system.
 */
function verifyInvariant(state: EscrowState, initialTotal: number): boolean {
  // 1. Total conservation
  if (!verifyConservation(state, initialTotal)) return false;

  // 2. Per-wallet ledger consistency
  for (const [walletId, wallet] of Object.entries(state.wallets)) {
    const inflows = state.ledger
      .filter((e) => e.to_wallet === walletId)
      .reduce((sum, e) => sum + e.amount, 0);
    const outflows = state.ledger
      .filter((e) => e.from_wallet === walletId)
      .reduce((sum, e) => sum + e.amount, 0);

    const netLedger = inflows - outflows;

    // The initial balance for client = initialTotal, for worker = 0
    const initialBalance = walletId === CLIENT ? initialTotal : 0;
    const currentBalance = wallet.available + wallet.locked;
    const delta = currentBalance - initialBalance;

    if (Math.abs(delta - netLedger) > 0.01) return false;
  }

  // 3. No negative balances
  for (const wallet of Object.values(state.wallets)) {
    if (wallet.available < -0.01 || wallet.locked < -0.01) return false;
  }

  return true;
}

describe("Escrow Property Tests (fast-check)", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("invariant holds across 10,000 random transition sequences", () => {
    // Arbitrary for milestone amounts (1-5 milestones, amounts 100-50000)
    const milestoneAmountsArb = fc.array(
      fc.integer({ min: 100, max: 50000 }),
      { minLength: 1, maxLength: 5 },
    );

    fc.assert(
      fc.property(
        milestoneAmountsArb,
        fc.array(
          fc.record({
            type: fc.constantFrom(
              "fund",
              "submit",
              "approve",
              "dispute",
              "admin_refund",
              "admin_force_release",
            ) as fc.Arbitrary<Action["type"]>,
            msIndex: fc.integer({ min: 0, max: 4 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (amounts, actions) => {
          resetIdCounter();
          const initialTotal = amounts.reduce((s, a) => s + a, 0) * 2;
          // Give client 2x the total so they can fund everything
          const state = createState(CLIENT, WORKER, amounts, initialTotal);

          for (const action of actions) {
            // Clamp msIndex to valid range
            const clampedAction = {
              ...action,
              msIndex: action.msIndex % amounts.length,
            };
            applyAction(state, clampedAction);
          }

          // The invariant must ALWAYS hold
          expect(verifyInvariant(state, initialTotal)).toBe(true);
        },
      ),
      { numRuns: 10000, seed: 42 },
    );
  });

  it("every terminal state has zero locked balance", () => {
    // If all milestones are in terminal states (released or refunded),
    // the client's locked balance must be zero
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 100, max: 10000 }), { minLength: 1, maxLength: 3 }),
        (amounts) => {
          resetIdCounter();
          const total = amounts.reduce((s, a) => s + a, 0) * 2;
          const state = createState(CLIENT, WORKER, amounts, total);

          // Drive every milestone through the happy path
          for (let i = 0; i < amounts.length; i++) {
            const msId = `ms-${i + 1}`;
            fundMilestone(state, msId, CLIENT);
            submitMilestone(state, msId);
            approveMilestone(state, msId, CLIENT, WORKER);
          }

          // All milestones should be released
          for (const ms of state.milestones) {
            expect(ms.status).toBe("released");
          }

          // Client locked must be zero
          expect(state.wallets[CLIENT].locked).toBe(0);
          // Total must be conserved
          expect(verifyConservation(state, total)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
