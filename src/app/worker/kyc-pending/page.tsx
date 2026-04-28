import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkerKycPendingPage() {
  return (
    <main className="app-shell min-h-dvh py-8">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Your KYC Is Under Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Thanks for submitting your details. Our team is verifying your Aadhaar, PAN, and selfie.
          </p>
          <p>
            Most reviews complete within 24-48 hours. You will receive a notification when approved.
          </p>
          <p>Once verified, you can access worker jobs and start applying immediately.</p>
        </CardContent>
      </Card>
    </main>
  );
}
