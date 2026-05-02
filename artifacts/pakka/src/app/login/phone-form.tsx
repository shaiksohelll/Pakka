import { useTransition } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requestOtpAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { phoneSchema, type PhoneInput } from "@/lib/schemas/auth";

export function LoginForm() {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const form = useForm<PhoneInput>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await requestOtpAction(values);
      if (!result.success) {
        toast.error(result.error ?? "Unable to send OTP.");
        return;
      }

      if (result.redirectTo) {
        navigate(result.redirectTo);
      }
    });
  });

  return (
    <form onSubmit={handleSubmit} className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Sign in with Phone OTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="flex items-center gap-2">
            <div className="rounded-md border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
              +91
            </div>
            <Input
              id="phone"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              autoComplete="tel-national"
              {...form.register("phone")}
            />
          </div>
          {form.formState.errors.phone ? (
            <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Enter your Indian mobile number. We will send an OTP to continue.
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 mt-auto border-t bg-background/95 py-4 backdrop-blur">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Sending OTP..." : "Send OTP"}
        </Button>
      </div>
    </form>
  );
}
