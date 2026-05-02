import { useTransition } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { completeClientOnboardingAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientOnboardingSchema, type ClientOnboardingInput } from "@/lib/schemas/onboarding";

const cityOptions = ["Hyderabad", "Bengaluru", "Chennai", "Mumbai", "Delhi", "Pune"];

export function ClientOnboardingForm() {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ClientOnboardingInput>({
    resolver: zodResolver(clientOnboardingSchema),
    defaultValues: {
      fullName: "",
      city: "",
    },
  });

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await completeClientOnboardingAction(values);
      if (!result.success) {
        toast.error(result.error ?? "Unable to complete onboarding.");
        return;
      }
      navigate(result.redirectTo ?? "/client");
    });
  });

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Client Onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" placeholder="Your full name" {...form.register("fullName")} />
            {form.formState.errors.fullName ? (
              <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>City</Label>
            <Select
              value={form.watch("city")}
              onValueChange={(value) =>
                form.setValue("city", value ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.city ? (
              <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 mt-auto border-t bg-background/95 py-4 backdrop-blur">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving..." : "Continue to Client App"}
        </Button>
      </div>
    </form>
  );
}
