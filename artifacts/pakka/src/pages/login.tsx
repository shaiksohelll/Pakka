import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithOtp } from "@/actions/auth";
import { phoneSchema } from "@/lib/schemas/auth";
import type { z } from "zod";

type PhoneForm = z.infer<typeof phoneSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const form = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "+91" },
  });

  async function onSubmit(values: PhoneForm) {
    setLoading(true);
    try {
      await signInWithOtp(values.phone);
      sessionStorage.setItem("pakka_phone", values.phone);
      navigate("/verify-otp");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/10 to-background">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-primary-foreground">P</span>
        </div>
        <h1 className="text-3xl font-bold text-primary">Pakka</h1>
        <p className="text-muted-foreground mt-1 text-sm">India's Trusted Job Escrow Platform</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-3">
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your mobile number to receive an OTP</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                placeholder="+91XXXXXXXXXX"
                inputMode="tel"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Demo: +919876500001–+919876500099 · OTP: 123456
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
