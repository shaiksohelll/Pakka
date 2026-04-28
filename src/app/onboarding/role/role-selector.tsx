"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Hammer, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { selectRoleAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleSchema, type RoleInput } from "@/lib/schemas/onboarding";

export function RoleSelector() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
  });

  const submitRole = (role: RoleInput["role"]) => {
    form.setValue("role", role, { shouldValidate: true });
    startTransition(async () => {
      const result = await selectRoleAction({ role });
      if (!result.success) {
        toast.error(result.error ?? "Unable to save role.");
        return;
      }
      router.push(result.redirectTo ?? "/");
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Choose your role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={() => submitRole("client")}
            className="w-full rounded-xl border p-4 text-left transition hover:border-primary"
            disabled={isPending}
          >
            <div className="mb-2 flex items-center gap-2 text-primary">
              <UserRound className="size-5" />
              <span className="font-semibold">Client</span>
            </div>
            <p className="text-sm text-muted-foreground">Post jobs and hire verified workers.</p>
          </button>

          <button
            type="button"
            onClick={() => submitRole("worker")}
            className="w-full rounded-xl border p-4 text-left transition hover:border-primary"
            disabled={isPending}
          >
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Hammer className="size-5" />
              <span className="font-semibold">Worker</span>
            </div>
            <p className="text-sm text-muted-foreground">Complete KYC and apply for jobs nearby.</p>
          </button>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 mt-auto border-t bg-background/95 py-4 backdrop-blur">
        <Button type="button" className="w-full" disabled>
          Select a card to continue
        </Button>
      </div>
    </div>
  );
}
