import type { Metadata } from "next";
import { WorkerApplications } from "./worker-applications";

export const metadata: Metadata = {
  title: "My Applications — Pakka",
  description: "Track your job applications and their status.",
};

export default function WorkerApplicationsPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">My Applications</h1>
        <p className="text-sm text-muted-foreground">Track the status of your job applications</p>
      </div>
      <WorkerApplications />
    </main>
  );
}
