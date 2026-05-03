import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyOtp } from "@/actions/auth";
import { supabase } from "@/lib/supabase";

export default function VerifyOtp() {
  const [, navigate] = useLocation();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const phone = sessionStorage.getItem("pakka_phone") ?? "";

  useEffect(() => {
    if (!phone) navigate("/login");
  }, [phone, navigate]);

  async function handleVerify() {
    if (otp.length < 6) {
      toast.error("Enter the full 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth failed");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_done")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.onboarding_done) {
        navigate(profile?.role ? `/onboarding/${profile.role}` : "/onboarding/role");
      } else if (profile.role === "client") {
        navigate("/client/jobs");
      } else if (profile.role === "worker") {
        navigate("/worker/feed");
      } else if (profile.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/onboarding/role");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid OTP");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/10 to-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enter OTP</CardTitle>
          <CardDescription>
            Sent to <span className="font-medium text-foreground">{phone}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            className="w-full"
            disabled={loading || otp.length < 6}
            onClick={handleVerify}
          >
            {loading ? "Verifying…" : "Verify OTP"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
