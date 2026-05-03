import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { clientOnboardingSchema } from "@/lib/schemas/onboarding";
import { completeClientOnboarding } from "@/actions/onboarding";
import type { z } from "zod";

type Form = z.infer<typeof clientOnboardingSchema>;

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const form = useForm<Form>({
    resolver: zodResolver(clientOnboardingSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: Form) {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await completeClientOnboarding(user.id, values.name);
      navigate("/client/jobs");
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
          <CardTitle>Set Up Your Profile</CardTitle>
          <CardDescription>Tell us a bit about yourself to get started as a Client</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Your Full Name</Label>
              <Input id="name" placeholder="e.g. Rahul Sharma" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Start Posting Jobs"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
