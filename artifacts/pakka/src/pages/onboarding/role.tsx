import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingRole() {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<"client" | "worker" | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase.from("profiles").upsert({ id: user.id, role: selected });
      navigate(`/onboarding/${selected}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary/10 to-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Welcome to Pakka</h1>
          <p className="text-muted-foreground mt-2">How will you use Pakka?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(
            [
              { role: "client", icon: Briefcase, title: "I'm a Client", desc: "Post jobs and hire workers" },
              { role: "worker", icon: HardHat, title: "I'm a Worker", desc: "Find jobs and earn money" },
            ] as const
          ).map(({ role, icon: Icon, title, desc }) => (
            <Card
              key={role}
              onClick={() => setSelected(role)}
              className={cn(
                "cursor-pointer transition-all border-2",
                selected === role
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    selected === role ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button className="w-full" disabled={!selected || loading} onClick={handleContinue}>
          {loading ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
