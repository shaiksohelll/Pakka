"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const schema = z.object({
  full_name: z.string().min(2, "At least 2 characters").max(80),
  city: z.string().min(2, "At least 2 characters").max(80),
});
type FormData = z.infer<typeof schema>;

export function EditProfileDialog({
  defaults,
  onSaved,
}: {
  defaults: { full_name: string; city: string };
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function onSubmit(data: FormData) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mountedRef.current) return;
      if (!user) {
        toast.error("Not signed in");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: data.full_name, city: data.city })
        .eq("id", user.id);
      if (!mountedRef.current) return;
      if (error) {
        toast.error("Update failed: " + error.message);
        return;
      }
      toast.success("Profile updated");
      setOpen(false);
      onSaved();
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => {
          reset(defaults);
          setOpen(true);
        }}
      >
        Edit profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your name and city.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
              {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
