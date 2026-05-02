import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientJobDetail } from "./client-job-detail";

export const metadata: Metadata = {
  title: "Job Details — Pakka",
  description: "View job details, milestones, and worker applications.",
};

export default function ClientJobDetailPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
      <Link
        href="/client/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Jobs
      </Link>
      <ClientJobDetail />
    </main>
  );
}
