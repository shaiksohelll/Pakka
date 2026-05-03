import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Camera, Upload } from "lucide-react";
import { workerOnboardingSchema } from "@/lib/schemas/onboarding";
import { completeWorkerOnboarding } from "@/actions/onboarding";
import type { z } from "zod";

type Form = z.infer<typeof workerOnboardingSchema>;

export default function WorkerOnboarding() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<Form>({
    resolver: zodResolver(workerOnboardingSchema),
    defaultValues: { name: "", aadhaar_last4: "" },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: Form) {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await completeWorkerOnboarding(user.id, values.name, values.aadhaar_last4, selfieFile ?? undefined);
      navigate("/worker/feed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary/10 to-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Worker KYC</CardTitle>
          <CardDescription>Complete your profile to start finding jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="As on your Aadhaar" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="aadhaar_last4">Last 4 Digits of Aadhaar</Label>
              <Input
                id="aadhaar_last4"
                placeholder="XXXX"
                maxLength={4}
                inputMode="numeric"
                {...form.register("aadhaar_last4")}
              />
              {form.formState.errors.aadhaar_last4 && (
                <p className="text-xs text-destructive">{form.formState.errors.aadhaar_last4.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Selfie Photo (optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
              />
              {selfiePreview ? (
                <div className="relative w-24 h-24 mx-auto">
                  <img
                    src={selfiePreview}
                    alt="Selfie preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload Selfie
                </Button>
              )}
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              KYC verification takes 1–2 business days. You can browse jobs while it's pending.
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting…" : "Submit KYC & Start"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
