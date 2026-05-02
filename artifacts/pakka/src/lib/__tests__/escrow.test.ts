import { describe, it, expect, beforeEach } from "vitest";
import {
  createState,
  resetIdCounter,
  fundMilestone,
  submitMilestone,
  approveMilestone,
  disputeMilestone,
  adminRefund,
  adminForceRelease,
  autoRelease,
  verifyConservation,
  verifyZeroSum,
} from "@/lib/escrow-machine";

const CLIENT = "client-1";
const WORKER = "worker-1";
const INITIAL_BALANCE = 50000;

describe("Escrow State Machine", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  // ── Scenario 1: fund → submit → approve (happy path) ───────────────────
  it("fund → submit → approve: releases funds to worker", () => {
    const state = createState(CLIENT, WORKER, [10000, 20000], INITIAL_BALANCE);

    // Fund first milestone
    fundMilestone(state, "ms-1", CLIENT);
    expect(state.wallets[CLIENT].available).toBe(40000);
    expect(state.wallets[CLIENT].locked).toBe(10000);
    expect(state.milestones[0].status).toBe("funded");

    // Worker submits
    submitMilestone(state, "ms-1");
    expect(state.milestones[0].status).toBe("submitted");
    expect(state.milestones[0].submitted_at).toBeTruthy();

    // Client approves
    approveMilestone(state, "ms-1", CLIENT, WORKER);
    expect(state.milestones[0].status).toBe("released");
    expect(state.wallets[CLIENT].locked).toBe(0);
    expect(state.wallets[WORKER].available).toBe(10000);

    // Verify conservation
    expect(verifyConservation(state, INITIAL_BALANCE)).toBe(true);
    expect(verifyZeroSum(state).valid).toBe(true);
  });

  // ── Scenario 2: fund → submit → dispute → admin refund ─────────────────
  it("fund → submit → dispute → admin refund: returns funds to client", () => {
    const state = createState(CLIENT, WORKER, [15000], INITIAL_BALANCE);

    fundMilestone(state, "ms-1", CLIENT);
    submitMilestone(state, "ms-1");
    disputeMilestone(state, "ms-1");

    expect(state.milestones[0].status).toBe("disputed");
    // Funds still locked during dispute
    expect(state.wallets[CLIENT].locked).toBe(15000);
    expect(state.wallets[CLIENT].available).toBe(35000);

    // Admin refunds
    adminRefund(state, "ms-1", CLIENT);
    expect(state.milestones[0].status).toBe("refunded");
    expect(state.wallets[CLIENT].locked).toBe(0);
    expect(state.wallets[CLIENT].available).toBe(50000);
    expect(state.wallets[WORKER].available).toBe(0);

    // Verify conservation
    expect(verifyConservation(state, INITIAL_BALANCE)).toBe(true);
    expect(verifyZeroSum(state).valid).toBe(true);
  });

  // ── Scenario 3: fund → submit → auto-release after 72h ─────────────────
  it("fund → submit → auto-release after 72h: releases to worker", () => {
    const state = createState(CLIENT, WORKER, [25000], INITIAL_BALANCE);

    fundMilestone(state, "ms-1", CLIENT);
    submitMilestone(state, "ms-1");

    // Simulate 73 hours passing
    const futureTime = Date.now() + 73 * 60 * 60 * 1000;
    const released = autoRelease(state, CLIENT, WORKER, futureTime);

    expect(released).toBe(1);
    expect(state.milestones[0].status).toBe("released");
    expect(state.wallets[CLIENT].locked).toBe(0);
    expect(state.wallets[WORKER].available).toBe(25000);

    // Verify conservation
    expect(verifyConservation(state, INITIAL_BALANCE)).toBe(true);
    expect(verifyZeroSum(state).valid).toBe(true);
  });

  // ── Scenario 4: disputed → admin force release ─────────────────────────
  it("disputed → admin force-release: releases to worker", () => {
    const state = createState(CLIENT, WORKER, [12000], INITIAL_BALANCE);

    fundMilestone(state, "ms-1", CLIENT);
    submitMilestone(state, "ms-1");
    disputeMilestone(state, "ms-1");
    adminForceRelease(state, "ms-1", CLIENT, WORKER);

    expect(state.milestones[0].status).toBe("released");
    expect(state.wallets[CLIENT].locked).toBe(0);
    expect(state.wallets[WORKER].available).toBe(12000);

    expect(verifyConservation(state, INITIAL_BALANCE)).toBe(true);
  });

  // ── Scenario 5: multi-milestone lifecycle ───────────────────────────────
  it("multi-milestone: mixed approve/dispute/refund", () => {
    const state = createState(CLIENT, WORKER, [5000, 10000, 15000], INITIAL_BALANCE);

    // Fund all
    fundMilestone(state, "ms-1", CLIENT);
    fundMilestone(state, "ms-2", CLIENT);
    fundMilestone(state, "ms-3", CLIENT);
    expect(state.wallets[CLIENT].available).toBe(20000);
    expect(state.wallets[CLIENT].locked).toBe(30000);

    // ms-1: happy path
    submitMilestone(state, "ms-1");
    approveMilestone(state, "ms-1", CLIENT, WORKER);

    // ms-2: dispute → refund
    submitMilestone(state, "ms-2");
    disputeMilestone(state, "ms-2");
    adminRefund(state, "ms-2", CLIENT);

    // ms-3: dispute → force release
    submitMilestone(state, "ms-3");
    disputeMilestone(state, "ms-3");
    adminForceRelease(state, "ms-3", CLIENT, WORKER);

    expect(state.wallets[CLIENT].available).toBe(30000); // 20k remaining + 10k refunded
    expect(state.wallets[CLIENT].locked).toBe(0);
    expect(state.wallets[WORKER].available).toBe(20000); // 5k + 15k released

    // Verify total money is conserved
    expect(verifyConservation(state, INITIAL_BALANCE)).toBe(true);
    expect(verifyZeroSum(state).valid).toBe(true);
  });

  // ── Invalid transition guards ───────────────────────────────────────────
  it("rejects funding an already funded milestone", () => {
    const state = createState(CLIENT, WORKER, [10000], INITIAL_BALANCE);
    fundMilestone(state, "ms-1", CLIENT);
    expect(() => fundMilestone(state, "ms-1", CLIENT)).toThrow("Cannot fund");
  });

  it("rejects submitting a pending milestone", () => {
    const state = createState(CLIENT, WORKER, [10000], INITIAL_BALANCE);
    expect(() => submitMilestone(state, "ms-1")).toThrow("Cannot submit");
  });

  it("rejects approving a pending milestone", () => {
    const state = createState(CLIENT, WORKER, [10000], INITIAL_BALANCE);
    expect(() => approveMilestone(state, "ms-1", CLIENT, WORKER)).toThrow("Cannot approve");
  });

  it("rejects funding with insufficient balance", () => {
    const state = createState(CLIENT, WORKER, [100000], 50000);
    expect(() => fundMilestone(state, "ms-1", CLIENT)).toThrow("Insufficient");
  });

  // ── auto-release respects time ──────────────────────────────────────────
  it("auto-release does NOT release before 72h", () => {
    const state = createState(CLIENT, WORKER, [10000], INITIAL_BALANCE);
    fundMilestone(state, "ms-1", CLIENT);
    submitMilestone(state, "ms-1");

    // Only 1 hour has passed
    const tooEarly = Date.now() + 1 * 60 * 60 * 1000;
    const released = autoRelease(state, CLIENT, WORKER, tooEarly);

    expect(released).toBe(0);
    expect(state.milestones[0].status).toBe("submitted");
  });

  // ── Ledger entry count ──────────────────────────────────────────────────
  it("creates correct number of ledger entries", () => {
    const state = createState(CLIENT, WORKER, [10000], INITIAL_BALANCE);
    fundMilestone(state, "ms-1", CLIENT);
    submitMilestone(state, "ms-1");
    approveMilestone(state, "ms-1", CLIENT, WORKER);

    // fund creates 1 entry, approve creates 1 entry = 2 total
    expect(state.ledger.length).toBe(2);
    expect(state.ledger[0].type).toBe("fund");
    expect(state.ledger[1].type).toBe("release");
  });
});
