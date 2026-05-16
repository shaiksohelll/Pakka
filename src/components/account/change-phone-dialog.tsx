"use client";

import { useEffect, useState } from "react";
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

// Matches app-wide phoneSchema in src/lib/schemas/auth.ts: 10 digits starting 6-9, with +91 prefix.
const INDIAN_PHONE_RE = /^\+91[6-9]\d{9}$/;

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

    useEffect(() => {
        if (!open) {
            setStep("phone");
            setNewPhone("");
            setOtp("");
            setLoading(false);
        }
    }, [open]);

    async function requestOtp() {
        if (!INDIAN_PHONE_RE.test(newPhone)) {
            toast.error("Enter a valid Indian phone number (+91 followed by 10 digits)");
            return;
        }
        if (newPhone === currentPhone) {
            toast.error("This is already your current phone number");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ phone: newPhone });
        setLoading(false);
        if (error) {
            toast.error("Could not send OTP: " + error.message);
            return;
        }
        setStep("otp");
        toast.success("OTP sent");
    }

    async function verifyOtp() {
        if (otp.length !== 6) {
            toast.error("Enter the 6-digit OTP");
            return;
        }
        setLoading(true);
        const { error: verifyError } = await supabase.auth.verifyOtp({
            phone: newPhone,
            token: otp,
            type: "phone_change",
        });
        if (verifyError) {
            setLoading(false);
            toast.error("OTP verification failed: " + verifyError.message);
            return;
        }
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            toast.error("Session lost. Please sign in again.");
            return;
        }
        const { error: profileError } = await supabase
            .from("profiles")
            .update({ phone: newPhone })
            .eq("id", user.id);
        setLoading(false);
        if (profileError) {
            toast.error(
                "Phone changed but profile mirror failed: " + profileError.message,
            );
            return;
        }
        toast.success("Phone updated");
        setOpen(false);
        onChanged();
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
                                ? "Enter your new phone number. We&apos;ll send a 6-digit OTP."
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