import { WorkerOnboardingForm } from "./worker-form";

export default function WorkerOnboardingPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 py-6">
        <WorkerOnboardingForm />
      </div>
    </main>
  );
}
