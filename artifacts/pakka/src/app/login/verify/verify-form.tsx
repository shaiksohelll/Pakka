import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { resendOtpAction, verifyOtpAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { otpSchema, type OtpInput } from "@/lib/schemas/auth";

type VerifyOtpFormProps = {
  phone: string;
};

export function VerifyOtpForm({ phone }: VerifyOtpFormProps) {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [isResending, startResending] = useTransition();
  const form = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      phone,
      otp: "",
    },
  });
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const maskedPhone = useMemo(() => `+91 ${phone}`, [phone]);

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await verifyOtpAction(values);
      if (!result.success) {
        toast.error(result.error ?? "OTP verification failed.");
        return;
      }
      navigate(result.redirectTo ?? "/");
    });
  });

  const handleOtpChange = (value: string) => {
    form.setValue("otp", value, { shouldValidate: true });
    if (value.length === 6) {
      void submit();
    }
  };

  const handleResend = () => {
    startResending(async () => {
      const result = await resendOtpAction({ phone });
      if (!result.success) {
        toast.error(result.error ?? "Unable to resend OTP.");
        return;
      }
      setSecondsLeft(60);
      toast.success("OTP resent.");
    });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Verify OTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number</Label>
            <p className="text-sm text-muted-foreground">{maskedPhone}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">6-digit OTP</Label>
            <InputOTP
              id="otp"
              maxLength={6}
              value={form.watch("otp")}
              onChange={handleOtpChange}
              containerClassName="justify-start"
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {form.formState.errors.otp ? (
              <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            className="px-0 text-accent"
            disabled={secondsLeft > 0 || isResending}
            onClick={handleResend}
          >
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend OTP"}
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 mt-auto border-t bg-background/95 py-4 backdrop-blur">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Verifying..." : "Verify OTP"}
        </Button>
      </div>
    </form>
  );
}
