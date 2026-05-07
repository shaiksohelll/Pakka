"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatInr, relativeTime } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────
type WalletData = {
  available_balance: number;
  locked_balance: number;
};

type LedgerEntry = {
  id: string;
  amount: number;
  type: "fund" | "release" | "refund" | "topup" | "withdraw";
  created_at: string;
  job_title: string;
  milestone_title: string | null;
  from_wallet: string | null;
  to_wallet: string | null;
};

type LockedByJob = {
  job_id: string;
  job_title: string;
  locked_amount: number;
  milestone_count: number;
};

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchWalletData(role: "client" | "worker", userId: string) {
  const supabase = createClient();

  const [walletRes, ledgerRes] = await Promise.all([
    supabase
      .from("wallets")
      .select("available_balance,locked_balance")
      .eq("profile_id", userId)
      .single(),
    supabase
      .from("escrow_ledger")
      .select(`
        id,amount,type,created_at,from_wallet,to_wallet,
        jobs!escrow_ledger_job_id_fkey(title),
        milestones!escrow_ledger_milestone_id_fkey(title)
      `)
      .or(`from_wallet.eq.${userId},to_wallet.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (walletRes.error) throw walletRes.error;

  const wallet: WalletData = {
    available_balance: Number(walletRes.data.available_balance),
    locked_balance: Number(walletRes.data.locked_balance),
  };

  const ledger: LedgerEntry[] = (ledgerRes.data ?? []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    type: e.type as LedgerEntry["type"],
    created_at: e.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    job_title: (e.jobs as any)?.title ?? "Unknown Job",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    milestone_title: (e.milestones as any)?.title ?? null,
    from_wallet: e.from_wallet,
    to_wallet: e.to_wallet,
  }));

  // Calculate locked breakdown by job (for clients)
  let lockedByJob: LockedByJob[] = [];
  if (role === "client") {
    // Get all milestones where funds are currently locked
    const { data: lockedMilestones } = await supabase
      .from("milestones")
      .select("job_id, amount, jobs!milestones_job_id_fkey(title)")
      .in("status", ["funded", "submitted", "disputed"]);

    if (lockedMilestones) {
      const jobMap = new Map<string, LockedByJob>();
      for (const m of lockedMilestones) {
        const existing = jobMap.get(m.job_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const title = (m.jobs as any)?.title ?? "Unknown Job";
        if (existing) {
          existing.locked_amount += Number(m.amount);
          existing.milestone_count += 1;
        } else {
          jobMap.set(m.job_id, {
            job_id: m.job_id,
            job_title: title,
            locked_amount: Number(m.amount),
            milestone_count: 1,
          });
        }
      }
      lockedByJob = Array.from(jobMap.values());
    }
  }

  return { wallet, ledger, lockedByJob, userId };
}

// ── Main component ────────────────────────────────────────────────────────────
export function WalletView({ role }: { role: "client" | "worker" }) {
  const { user } = useUser();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet", role, user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: () => fetchWalletData(role, user!.id),
  });

  if (isLoading) return <WalletSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load wallet. Please refresh.
      </div>
    );
  }

  const { wallet, ledger, lockedByJob, userId } = data;

  return (
    <div className="space-y-6">
      {/* ── Balance cards ── */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-5 space-y-1">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Available
            </p>
          </div>
          <p className="text-2xl font-bold text-emerald-700">
            {formatInr(wallet.available_balance)}
          </p>
          <p className="text-xs text-muted-foreground">
            {role === "client" ? "Ready to fund milestones" : "Ready to withdraw"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-1">
          <div className="flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Locked
            </p>
          </div>
          <p className="text-2xl font-bold text-blue-700">
            {formatInr(wallet.locked_balance)}
          </p>
          <p className="text-xs text-muted-foreground">In active escrows</p>
        </div>
      </section>

      {/* ── Locked breakdown (client only) ── */}
      {role === "client" && lockedByJob.length > 0 && (
        <>
          <Separator />
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Locked Breakdown
            </h2>
            <ul className="space-y-2">
              {lockedByJob.map((job) => (
                <li
                  key={job.job_id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{job.job_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.milestone_count} milestone{job.milestone_count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-700">
                    {formatInr(job.locked_amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Separator />

      {/* ── Transaction history ── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent Transactions
        </h2>
        {ledger.length === 0 ? (
          <div className="rounded-xl border bg-muted/40 py-10 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {ledger.map((entry) => {
              const isOutgoing = entry.from_wallet === userId;
              const isIncoming = entry.to_wallet === userId && entry.from_wallet !== userId;

              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isIncoming
                          ? "bg-emerald-100 text-emerald-700"
                          : isOutgoing
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {isIncoming ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {entry.milestone_title ?? entry.job_title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusBadge
                          variant={
                            entry.type === "fund"
                              ? "funded"
                              : entry.type === "release"
                                ? "released"
                                : entry.type === "refund"
                                  ? "refunded"
                                  : "pending"
                          }
                        />
                        <span>{relativeTime(entry.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isIncoming ? "text-emerald-700" : "text-foreground"
                    }`}
                  >
                    {isIncoming ? "+" : "-"}
                    {formatInr(entry.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Separator />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
