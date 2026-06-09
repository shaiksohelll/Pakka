"use client";

import { generateUuid } from "@/lib/uuid";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { topupWalletAction } from "@/app/_actions/wallet";
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

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  (e.target as HTMLInputElement).blur();
};

export function TopUpDialog() {
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
      const result = await topupWalletAction({
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
      toast.success(`Added ${formatInr(amount)}. New balance: ${formatInr(newBalance)}`);
      setAmountStr("");
      setOpen(false);
    },
    onError: (err: Error) => {
      if (!mountedRef.current) return;
      toast.error(err.message || "Could not top up wallet. Please try again.");
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const isPending = mutation.isPending;

  const handleSubmit = () => {
    if (inFlightRef.current || isPending) return;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 100 || amount > 100000) {
      toast.error("Amount must be between ₹100 and ₹1,00,000.");
      return;
    }
    inFlightRef.current = true;
    mutation.mutate(amount);
  };

  return (
    <>
      <Button size="sm" variant="default" className="gap-1.5" onClick={() => setOpen(true)} data-testid="add-money">
        <Plus className="h-4 w-4" />
        Add Money
      </Button>
      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add money to wallet</DialogTitle>
            <DialogDescription>
              Test-mode top-up. {formatInr(100)} – {formatInr(100000)}.
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
                max={100000}
                step={100}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onWheel={blurOnWheel}
                disabled={isPending}
                data-testid="topup-amount"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setAmountStr(String(amt))}
                >
                  {formatInr(amt)}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="topup-confirm">
              {isPending ? "Processing…" : "Add money"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
