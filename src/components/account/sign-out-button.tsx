"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onError: (error: Error) => {
      toast.error("Sign out failed: " + error.message);
    },
    onSuccess: () => {
      router.push("/");
    },
  });

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Pakka?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be returned to the login screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => signOutMutation.mutate()}
              disabled={signOutMutation.isPending}
            >
              {signOutMutation.isPending ? "Signing out..." : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
