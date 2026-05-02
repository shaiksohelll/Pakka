import { useSearch } from "wouter";
import { VerifyOtpForm } from "./verify-form";

export default function VerifyPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") ?? "";

  return (
    <main className="mx-auto max-w-[480px] px-4 py-6">
      <VerifyOtpForm phone={phone} />
    </main>
  );
}
