"use client";

import { generateUuid } from "@/lib/uuid";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { withdrawWalletAction } from "@/app/_actions/wallet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/format";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  (e.target as HTMLInputElement).blur();
};

export function WithdrawDialog({ availableBalance }: { availableBalance: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  // Stable idempotency key for the lifetime of an open dialog. Resets each
  // time the dialog closes so the next open starts a fresh logical request.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateUuid());
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) setIdempotencyKey(generateUuid());
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      const result = await withdrawWalletAction({
        amount,
        idempotency_key: idempotencyKey,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return { amount, newBalance: result.data?.availableBalance ?? 0 };
    },
    onSuccess: ({ amount, newBalance }) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (!mountedRef.current) return;
      toast.success(`Withdrew ${formatInr(amount)}. New balance: ${formatInr(newBalance)}`);
      setAmountStr("");
      setOpen(false);
    },
    onError: (err: Error) => {
      if (!mountedRef.current) return;
      toast.error(err.message || "Could not withdraw from wallet. Please try again.");
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const isPending = mutation.isPending;
  const amount = Number(amountStr);
  const isValidAmount = Number.isFinite(amount) && amount >= 100 && amount <= availableBalance;
  const canWithdraw = availableBalance >= 100;

  const handleSubmit = () => {
    if (inFlightRef.current || isPending) return;
    if (!Number.isFinite(amount) || amount < 100) {
      toast.error("Amount must be at least ₹100.");
      return;
    }
    if (amount > availableBalance) {
      toast.error("Amount exceeds available balance.");
      return;
    }
    inFlightRef.current = true;
    mutation.mutate(amount);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={!canWithdraw}
      >
        <ArrowDownToLine className="h-4 w-4" />
        Withdraw
      </Button>
      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from wallet</DialogTitle>
            <DialogDescription>
              Available balance: {formatInr(availableBalance)}. Minimum withdrawal {formatInr(100)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <span className="text-sm font-medium">Amount</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                min={100}
                max={availableBalance}
                step={100}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onWheel={blurOnWheel}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending || amt > availableBalance}
                  onClick={() => setAmountStr(String(amt))}
                >
                  {formatInr(amt)}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !canWithdraw}
                onClick={() => setAmountStr(String(availableBalance))}
              >
                Max
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !isValidAmount}>
              {isPending ? "Processing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
