import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fund Escrow — Pakka",
  description: "Escrow funding will be available in the next phase.",
};

export default function FundEscrowPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-16 flex flex-col items-center text-center gap-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-10 w-10 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">Escrow Funding</h1>
        <p className="text-muted-foreground">
          Funding your escrow is coming in the next phase. Your job has been assigned —
          stay tuned for the payment flow!
        </p>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
        Phase 4 will introduce milestone-by-milestone escrow funding with Razorpay and wallet top-up.
      </div>

      <Link href=".." className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
        <ArrowLeft className="h-4 w-4" />
        Back to Job
      </Link>
    </main>
  );
}
