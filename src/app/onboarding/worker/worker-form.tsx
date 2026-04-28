"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { completeWorkerOnboardingAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  workerCategories,
  workerOnboardingSchema,
  type WorkerOnboardingInput,
} from "@/lib/schemas/onboarding";

const STEPS = ["Name", "Aadhaar", "PAN", "Selfie", "Skills"] as const;

export function WorkerOnboardingForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [skillInput, setSkillInput] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const form = useForm<WorkerOnboardingInput>({
    resolver: zodResolver(workerOnboardingSchema),
    defaultValues: {
      fullName: "",
      aadhaar: "",
      aadhaarLast4: "",
      pan: "",
      panLast4: "",
      categories: [],
      skillTags: [],
    },
  });

  const selectedCategories = form.watch("categories");
  const skillTags = form.watch("skillTags") ?? [];

  const stepTitle = useMemo(() => STEPS[currentStep], [currentStep]);

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < STEPS.length - 1;

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const toggleCategory = (category: (typeof workerCategories)[number]) => {
    const hasCategory = selectedCategories.includes(category);
    if (hasCategory) {
      form.setValue(
        "categories",
        selectedCategories.filter((value) => value !== category),
        { shouldValidate: true },
      );
      return;
    }

    if (selectedCategories.length >= 3) {
      toast.error("You can select up to 3 categories.");
      return;
    }

    form.setValue("categories", [...selectedCategories, category], { shouldValidate: true });
  };

  const addSkillTag = () => {
    const value = skillInput.trim().toLowerCase();
    if (!value) return;
    if (skillTags.includes(value)) {
      setSkillInput("");
      return;
    }
    if (skillTags.length >= 8) {
      toast.error("You can add up to 8 skill tags.");
      return;
    }
    form.setValue("skillTags", [...skillTags, value], { shouldValidate: true });
    setSkillInput("");
  };

  const removeSkillTag = (value: string) => {
    form.setValue(
      "skillTags",
      skillTags.filter((tag) => tag !== value),
      { shouldValidate: true },
    );
  };

  const submit = form.handleSubmit((values) => {
    if (!selfieFile) {
      toast.error("Please capture or upload a selfie.");
      return;
    }

    startTransition(async () => {
      const payload = new FormData();
      const normalizedSkillTags = values.skillTags ?? [];
      payload.set("fullName", values.fullName);
      payload.set("aadhaar", values.aadhaar);
      payload.set("aadhaarLast4", values.aadhaarLast4);
      payload.set("pan", values.pan.toUpperCase());
      payload.set("panLast4", values.panLast4.toUpperCase());
      payload.set("selfie", selfieFile);
      values.categories.forEach((category) => payload.append("categories", category));
      normalizedSkillTags.forEach((tag) => payload.append("skillTags", tag));

      const result = await completeWorkerOnboardingAction(payload);
      if (!result.success) {
        toast.error(result.error ?? "Unable to complete worker onboarding.");
        return;
      }

      router.push(result.redirectTo ?? "/worker/kyc-pending");
    });
  });

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl text-primary">
            Worker KYC - Step {currentStep + 1}/5: {stepTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 0 ? (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="Your legal name" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              ) : null}
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input
                  id="aadhaar"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12-digit Aadhaar"
                  {...form.register("aadhaar")}
                />
                {form.formState.errors.aadhaar ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.aadhaar.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="aadhaarLast4">Aadhaar Last 4</Label>
                <Input
                  id="aadhaarLast4"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Last 4 digits"
                  {...form.register("aadhaarLast4")}
                />
                {form.formState.errors.aadhaarLast4 ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.aadhaarLast4.message}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pan">PAN Number</Label>
                <Input id="pan" maxLength={10} placeholder="ABCDE1234F" {...form.register("pan")} />
                {form.formState.errors.pan ? (
                  <p className="text-xs text-destructive">{form.formState.errors.pan.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="panLast4">PAN Last 4</Label>
                <Input
                  id="panLast4"
                  maxLength={4}
                  placeholder="1234F"
                  {...form.register("panLast4")}
                />
                {form.formState.errors.panLast4 ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.panLast4.message}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-2">
              <Label htmlFor="selfie">Capture Selfie</Label>
              <Input
                id="selfie"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelfieFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Upload goes to the `kyc` bucket as a storage path, not a public URL.
              </p>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categories (max 3)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {workerCategories.map((category) => {
                    const active = selectedCategories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`rounded-md border px-3 py-2 text-left text-xs capitalize ${
                          active ? "border-primary bg-primary/10 text-primary" : ""
                        }`}
                        onClick={() => toggleCategory(category)}
                      >
                        {category.replace("-", " ")}
                      </button>
                    );
                  })}
                </div>
                {form.formState.errors.categories ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.categories.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Skill Tags (max 8)</Label>
                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={(event) => setSkillInput(event.target.value)}
                    placeholder="e.g. rewiring"
                  />
                  <Button type="button" variant="outline" onClick={addSkillTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skillTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs"
                      onClick={() => removeSkillTag(tag)}
                    >
                      {tag} x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 mt-auto border-t bg-background/95 py-4 backdrop-blur">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!canGoBack}
            onClick={prevStep}
          >
            Back
          </Button>
          {canGoNext ? (
            <Button type="button" className="w-full" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit KYC"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
