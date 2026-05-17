"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
import { Label } from "@/components/ui/label";

import { topupWalletAction } from "@/app/_actions/wallet";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

export function TopUpDialog() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [amountStr, setAmountStr] = useState("");
    const [isPending, startTransition] = useTransition();
    const inFlightRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    function handleTopUp() {
        const amount = Number(amountStr);
        if (!Number.isFinite(amount) || amount < 100) {
            toast.error("Enter at least ₹100.");
            return;
        }
        if (amount > 100000) {
            toast.error("Maximum top-up is ₹1,00,000.");
            return;
        }
        if (inFlightRef.current) return;
        inFlightRef.current = true;

        startTransition(async () => {
            try {
                const result = await topupWalletAction({
                    amount,
                    idempotency_key: crypto.randomUUID(),
                });

                if (!result.success) {
                    if (mountedRef.current) toast.error(result.error);
                    return;
                }

                // Cache invalidation — safe to run regardless of mount state.
                // Adjust query keys below if yours differ.
                queryClient.invalidateQueries({ queryKey: ["wallet"] });

                if (mountedRef.current) {
                    const newBalance = result.data?.availableBalance ?? 0;
                    toast.success(
                        `Added ₹${amount.toLocaleString("en-IN")}. New balance: ₹${newBalance.toLocaleString("en-IN")}.`,
                    );
                    setAmountStr("");
                    setOpen(false);
                }
            } finally {
                inFlightRef.current = false;
            }
        });
    }

    return (
        <>
            <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => setOpen(true)}
            >
                <Plus className="h-4 w-4" />
                Add Money
            </Button>
            <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add money to wallet</DialogTitle>
                        <DialogDescription>
                            Test-mode top-up. ₹100 – ₹1,00,000.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="topup-amount">Amount (₹)</Label>
                            <Input
                                id="topup-amount"
                                type="number"
                                inputMode="numeric"
                                min={100}
                                max={100000}
                                step={100}
                                placeholder="1000"
                                value={amountStr}
                                onChange={(e) => setAmountStr(e.target.value)}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                                    disabled={isPending}
                                    onClick={() => setAmountStr(String(amt))}
                                >
                                    ₹{amt.toLocaleString("en-IN")}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="button" disabled={isPending} onClick={handleTopUp}>
                            {isPending ? "Adding..." : "Add Money"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}