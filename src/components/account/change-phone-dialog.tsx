"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ChangePhoneDialog({
    currentPhone,
    onChanged,
}: {
    currentPhone: string | null;
    onChanged: () => void;
}) {
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [newPhone, setNewPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    function resetState() {
        setStep("phone");
        setNewPhone("");
        setOtp("");
    }

    async function requestOtp() {
        if (!/^\+91\d{10}$/.test(newPhone)) {
            toast.error("Enter phone in format +91XXXXXXXXXX");
            return;
        }
        if (newPhone === currentPhone) {
            toast.error("Same as current number");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ phone: newPhone });
        setLoading(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        toast.success("OTP sent to " + newPhone);
        setStep("otp");
    }

    async function verifyOtp() {
        if (!/^\d{6}$/.test(otp)) {
            toast.error("Enter the 6-digit OTP");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.verifyOtp({
            phone: newPhone,
            token: otp,
            type: "phone_change",
        });
        if (error) {
            setLoading(false);
            toast.error(error.message);
            return;
        }
        // Keep profiles.phone in sync (UNIQUE constraint).
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user) {
            await supabase.from("profiles").update({ phone: newPhone }).eq("id", user.id);
        }
        setLoading(false);
        toast.success("Phone updated");
        setOpen(false);
        resetState();
        onChanged();
    }

    return (
        <>
            <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setOpen(true)}
            >
                Change phone number
            </Button>
            <Dialog
                open={open}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) resetState();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change phone number</DialogTitle>
                        <DialogDescription>
                            {step === "phone"
                                ? "Enter your new phone number. We'll send a 6-digit OTP."
                                : `Enter the OTP sent to ${newPhone}.`}
                        </DialogDescription>
                    </DialogHeader>
                    {step === "phone" ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-phone">New phone number</Label>
                                <Input
                                    id="new-phone"
                                    placeholder="+919876500001"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Current: {currentPhone ?? "—"}
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={requestOtp} disabled={loading}>
                                    {loading ? "Sending..." : "Send OTP"}
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp">6-digit OTP</Label>
                                <Input
                                    id="otp"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setStep("phone")}>
                                    Back
                                </Button>
                                <Button onClick={verifyOtp} disabled={loading}>
                                    {loading ? "Verifying..." : "Verify"}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}