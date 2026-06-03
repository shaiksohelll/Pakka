"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { z } from "zod";
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

const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", {
    errorMap: () => ({ message: 'Type "DELETE" to confirm' }),
  }),
  reason: z.string().max(500).optional(),
});

export function DeleteAccountDialog() {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
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
      setConfirm("");
      setReason("");
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [open]);

  async function handleDelete() {
    if (inFlightRef.current) return;

    // Validate with Zod on client side
    const parsed = deleteAccountSchema.safeParse({ confirm, reason: reason || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Type "DELETE" to confirm');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("request_account_deletion", {
        reason: reason || "",
      });
      if (!mountedRef.current) return;
      if (error) {
        toast.error("Could not submit deletion request: " + error.message);
        return;
      }
      const { error: signOutError } = await supabase.auth.signOut();
      if (!mountedRef.current) return;
      if (signOutError) {
        toast.error("Deletion requested, but sign-out failed: " + signOutError.message);
        return;
      }
      toast.success("Account deletion requested. Our team will process it within 7 days.");
      router.push("/login");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This submits a deletion request. Our team processes it within 7 days. You will be
              signed out immediately.
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
              <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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
