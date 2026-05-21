import { redirect } from "next/navigation";

// Phase 4: Fund page is now the milestones page.
// Redirect any old links pointing here.
export default async function FundEscrowRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/client/jobs/${id}/milestones`);
}
