"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { indianPhoneRegex, otpRegex } from "@/lib/schemas/auth";

export function ChangePhoneDialog({
  currentPhone,
  onChanged,
}: {
  currentPhone: string;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setNewPhone("");
      setOtp("");
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [open]);

  async function requestOtp() {
    if (inFlightRef.current) return;

    // Validate phone using shared Zod schema regex
    const digits = newPhone.replace(/^\+91/, "");
    if (!indianPhoneRegex.test(digits)) {
      toast.error("Enter a valid Indian phone number (+91 followed by 10 digits)");
      return;
    }
    if (newPhone === currentPhone) {
      toast.error("This is already your current phone number");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: newPhone });
      if (!mountedRef.current) return;
      if (error) {
        toast.error("Could not send OTP: " + error.message);
        return;
      }
      setStep("otp");
      toast.success("OTP sent");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  async function verifyOtp() {
    if (inFlightRef.current) return;

    // Validate OTP using shared Zod schema regex
    if (!otpRegex.test(otp)) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: newPhone,
        token: otp,
        type: "phone_change",
      });
      if (!mountedRef.current) return;
      if (verifyError) {
        toast.error("OTP verification failed: " + verifyError.message);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mountedRef.current) return;
      if (!user) {
        toast.error("Session lost. Please sign in again.");
        return;
      }
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ phone: newPhone })
        .eq("id", user.id);
      if (!mountedRef.current) return;
      if (profileError) {
        toast.error("Phone changed but profile mirror failed: " + profileError.message);
        return;
      }
      toast.success("Phone updated");
      setOpen(false);
      onChanged();
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <Phone className="h-4 w-4" />
        Change phone
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change phone</DialogTitle>
            <DialogDescription>
              {step === "phone"
                ? "Enter your new phone number. We\u0027ll send a 6-digit OTP."
                : `Enter the OTP sent to ${newPhone}.`}
            </DialogDescription>
          </DialogHeader>

          {step === "phone" ? (
            <div className="space-y-2">
              <Label htmlFor="newPhone">New phone</Label>
              <Input
                id="newPhone"
                inputMode="tel"
                placeholder="+919876500001"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            {step === "phone" ? (
              <Button onClick={requestOtp} disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            ) : (
              <Button onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify and update"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
