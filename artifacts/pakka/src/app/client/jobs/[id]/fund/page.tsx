import { Redirect, useParams } from "wouter";

export default function FundEscrowRedirect() {
  const params = useParams<{ id: string }>();
  return <Redirect to={`/client/jobs/${params.id}/milestones`} />;
}
