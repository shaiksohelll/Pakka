import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { WalletView } from "@/components/features/wallet-view";

export default function ClientWalletPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
      <Link
        href="/client"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-xl font-bold text-primary">My Wallet</h1>
      <WalletView role="client" />
    </main>
  );
}
