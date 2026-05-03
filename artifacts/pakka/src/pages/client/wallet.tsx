import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingDown, TrendingUp, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { useUser } from "@/hooks/use-user";
import { getWalletTxns } from "@/actions/escrow";
import { formatInr, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TXN_ICONS = {
  credit: TrendingUp,
  debit: TrendingDown,
  hold: LockKeyhole,
  release: TrendingUp,
};

export default function ClientWallet() {
  const { data: user } = useUser();

  const { data: txns, isLoading } = useQuery({
    queryKey: ["wallet-txns", user?.id],
    queryFn: () => getWalletTxns(user!.id),
    enabled: !!user?.id,
  });

  return (
    <PageShell title="Wallet" role="client">
      <div className="p-4 space-y-4">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm opacity-80">Available Balance</p>
              <p className="text-3xl font-bold">{formatInr(user?.wallet_balance ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))
            ) : txns?.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              txns?.map((txn) => {
                const Icon = TXN_ICONS[txn.type] ?? Wallet;
                const isPositive = txn.type === "credit" || txn.type === "release";
                return (
                  <div key={txn.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center",
                        isPositive ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.description ?? txn.type}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(txn.created_at)}</p>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isPositive ? "text-green-600" : "text-orange-600"
                      )}
                    >
                      {isPositive ? "+" : "-"}{formatInr(txn.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
