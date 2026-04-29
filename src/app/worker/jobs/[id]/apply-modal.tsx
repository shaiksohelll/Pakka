"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { applyJobFormSchema, type ApplyJobFormInput } from "@/lib/schemas/jobs";
import { applyToJobAction } from "@/app/_actions/jobs";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ApplyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  totalBudget: number;
  onSuccess: () => void;
};

export function ApplyModal({
  open,
  onOpenChange,
  jobId,
  totalBudget,
  onSuccess,
}: ApplyModalProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ApplyJobFormInput>({
    resolver: zodResolver(applyJobFormSchema),
    defaultValues: {
      job_id: jobId,
      total_budget: totalBudget,
      bid_amount: undefined as unknown as number,
      eta_days: undefined as unknown as number,
      message: "",
    },
  });

  const {
    register,
    formState: { errors },
    watch,
    setValue,
    handleSubmit,
    reset,
  } = form;

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await applyToJobAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Application submitted!");
      reset();
      onOpenChange(false);
      onSuccess();
    });
  });

  const budgetLow = Math.round(totalBudget * 0.8);
  const budgetHigh = Math.round(totalBudget * 1.2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Apply for this Job</DialogTitle>
          <DialogDescription>
            Budget: {formatInr(totalBudget)} · Acceptable bid range: {formatInr(budgetLow)} –{" "}
            {formatInr(budgetHigh)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Hidden fields */}
          <input type="hidden" {...register("job_id")} value={jobId} />
          <input type="hidden" {...register("total_budget", { valueAsNumber: true })} value={totalBudget} />

          <div className="space-y-1.5">
            <Label htmlFor="bid_amount">Your Bid (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₹
              </span>
              <Input
                id="bid_amount"
                type="number"
                className="pl-7"
                placeholder={String(totalBudget)}
                value={watch("bid_amount") ?? ""}
                onChange={(e) =>
                  setValue(
                    "bid_amount",
                    e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
                    { shouldValidate: true },
                  )
                }
              />
            </div>
            {errors.bid_amount && (
              <p className="text-xs text-destructive">{errors.bid_amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eta_days">ETA (days)</Label>
            <Input
              id="eta_days"
              type="number"
              min={1}
              max={60}
              placeholder="e.g. 7"
              value={watch("eta_days") ?? ""}
              onChange={(e) =>
                setValue(
                  "eta_days",
                  e.target.value ? parseInt(e.target.value, 10) : (undefined as unknown as number),
                  { shouldValidate: true },
                )
              }
            />
            {errors.eta_days && (
              <p className="text-xs text-destructive">{errors.eta_days.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              rows={3}
              placeholder="Describe your experience and approach…"
              {...register("message")}
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {watch("message")?.length ?? 0} / 500
            </p>
            {errors.message && (
              <p className="text-xs text-destructive">{errors.message.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Submitting…" : "Submit Application"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
