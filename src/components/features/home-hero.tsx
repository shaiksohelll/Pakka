import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeHero() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-medium text-accent">Next.js 15 Starter</p>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        pakka
      </h1>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">
        App Router, strict TypeScript, Tailwind v4, shadcn/ui, Supabase, React
        Query, and production-ready defaults.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Badge label="Bronze" className="bg-trust-bronze text-white" />
        <Badge label="Silver" className="bg-trust-silver text-slate-900" />
        <Badge label="Gold" className="bg-trust-gold text-slate-900" />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          Launch Dashboard
        </Button>
        <Button
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10"
        >
          View Docs
        </Button>
      </div>
    </section>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${className}`}
    >
      <ShieldCheck className="size-3.5" />
      {label}
    </span>
  );
}
