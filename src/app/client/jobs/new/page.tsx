import type { Metadata } from "next";
import { PostJobForm } from "./post-job-form";

export const metadata: Metadata = {
  title: "Post a Job — Pakka",
  description: "Post a new job with milestones and escrow protection.",
};

export default function NewJobPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6">
      <PostJobForm />
    </main>
  );
}
