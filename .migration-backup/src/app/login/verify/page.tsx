import { VerifyOtpForm } from "./verify-form";

type VerifyPageProps = {
  searchParams: Promise<{ phone?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const phone = params.phone ?? "";

  return (
    <main className="app-shell min-h-dvh py-6">
      <VerifyOtpForm phone={phone} />
    </main>
  );
}
