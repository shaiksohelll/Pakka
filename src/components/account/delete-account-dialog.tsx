"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function DeleteAccountDialog() {
    const router = useRouter();
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRequest() {
        if (confirm !== "DELETE") {
            toast.error('Type "DELETE" to confirm');
            return;
        }
        setLoading(true);
        const { error } = await supabase.rpc("request_account_deletion", {
            reason: reason || null,
        });
        if (error) {
            setLoading(false);
            toast.error("Request failed: " + error.message);
            return;
        }
        await supabase.auth.signOut();
        setLoading(false);
        toast.success(
            "Account deletion requested. Our team will process it within 7 days."
        );
        router.push("/");
    }

    return (
        <>
            <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setOpen(true)}
            >
                Delete account
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete your Pakka account?</DialogTitle>
                        <DialogDescription>
                            This sends a deletion request to our team. Your data will be removed
                            within 7 days. Open jobs and locked funds may delay processing. This
                            action is irreversible once processed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason (optional)</Label>
                            <Input
                                id="reason"
                                placeholder="Why are you leaving?"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Type DELETE to confirm</Label>
                            <Input
                                id="confirm"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRequest}
                            disabled={loading || confirm !== "DELETE"}
                        >
                            {loading ? "Submitting..." : "Request deletion"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}