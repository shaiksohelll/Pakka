"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
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

function Step0() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WorkerOnboardingInput>();
  return (
    <div className="space-y-2">
      <Label htmlFor="fullName">Full Name</Label>
      <Input id="fullName" placeholder="Your legal name" {...register("fullName")} />
      {errors.fullName ? (
        <p className="text-xs text-destructive">{errors.fullName.message as string}</p>
      ) : null}
    </div>
  );
}

function Step1() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WorkerOnboardingInput>();
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="aadhaar">Aadhaar Number</Label>
        <Input
          id="aadhaar"
          inputMode="numeric"
          maxLength={12}
          placeholder="12-digit Aadhaar"
          {...register("aadhaar")}
        />
        {errors.aadhaar ? (
          <p className="text-xs text-destructive">{errors.aadhaar.message as string}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="aadhaarLast4">Aadhaar Last 4</Label>
        <Input
          id="aadhaarLast4"
          inputMode="numeric"
          maxLength={4}
          placeholder="Last 4 digits"
          {...register("aadhaarLast4")}
        />
        {errors.aadhaarLast4 ? (
          <p className="text-xs text-destructive">{errors.aadhaarLast4.message as string}</p>
        ) : null}
      </div>
    </div>
  );
}

function Step2() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WorkerOnboardingInput>();
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="pan">PAN Number</Label>
        <Input id="pan" maxLength={10} placeholder="ABCDE1234F" {...register("pan")} />
        {errors.pan ? (
          <p className="text-xs text-destructive">{errors.pan.message as string}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="panLast4">PAN Last 4</Label>
        <Input id="panLast4" maxLength={4} placeholder="1234F" {...register("panLast4")} />
        {errors.panLast4 ? (
          <p className="text-xs text-destructive">{errors.panLast4.message as string}</p>
        ) : null}
      </div>
    </div>
  );
}

function Step3() {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WorkerOnboardingInput>();
  const selfieFile = watch("selfie") as File | undefined;

  const previewUrl = useMemo(() => {
    if (selfieFile instanceof File) {
      return URL.createObjectURL(selfieFile);
    }
    return null;
  }, [selfieFile]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="selfie">Capture Selfie</Label>
        <Input
          id="selfie"
          type="file"
          accept="image/*"
          capture="user"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file) {
              setValue("selfie", file, { shouldValidate: true, shouldDirty: true });
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Upload goes to the `kyc` bucket as a storage path, not a public URL.
        </p>
        {errors.selfie ? (
          <p className="text-xs text-destructive">{errors.selfie.message as string}</p>
        ) : null}
      </div>

      {previewUrl && (
        <div className="rounded-lg border overflow-hidden w-32 h-32 relative bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selfie preview" className="object-cover w-full h-full" />
        </div>
      )}
    </div>
  );
}

function Step4() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WorkerOnboardingInput>();
  const [skillInput, setSkillInput] = useState("");

  const selectedCategories = watch("categories") ?? [];
  const skillTags = watch("skillTags") ?? [];

  const toggleCategory = (category: (typeof workerCategories)[number]) => {
    const hasCategory = selectedCategories.includes(category);
    if (hasCategory) {
      setValue(
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

    setValue("categories", [...selectedCategories, category], { shouldValidate: true });
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
    setValue("skillTags", [...skillTags, value], { shouldValidate: true });
    setSkillInput("");
  };

  const removeSkillTag = (value: string) => {
    setValue(
      "skillTags",
      skillTags.filter((tag) => tag !== value),
      { shouldValidate: true },
    );
  };

  return (
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
                className={`rounded-md border px-3 py-2 text-left text-xs capitalize ${active ? "border-primary bg-primary/10 text-primary" : ""
                  }`}
                onClick={() => toggleCategory(category)}
              >
                {category.replace("-", " ")}
              </button>
            );
          })}
        </div>
        {errors.categories ? (
          <p className="text-xs text-destructive">{errors.categories.message as string}</p>
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
              {tag} ×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkerOnboardingForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();

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
      selfie: undefined,
    },
    mode: "onBlur",
  });

  const stepTitle = useMemo(() => STEPS[currentStep], [currentStep]);

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < STEPS.length - 1;

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const payload = new FormData();
        const normalizedSkillTags = values.skillTags ?? [];
        payload.set("fullName", values.fullName);
        payload.set("aadhaar", values.aadhaar);
        payload.set("aadhaarLast4", values.aadhaarLast4);
        payload.set("pan", values.pan.toUpperCase());
        payload.set("panLast4", values.panLast4.toUpperCase());
        if (values.selfie instanceof File) {
          payload.set("selfie", values.selfie);
        }
        values.categories.forEach((category) => payload.append("categories", category));
        normalizedSkillTags.forEach((tag) => payload.append("skillTags", tag));

        const result = await completeWorkerOnboardingAction(payload);
        if (!result.success) {
          toast.error(result.error ?? "Unable to complete worker onboarding.");
          return;
        }

        router.push(result.redirectTo ?? "/worker/kyc-pending");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        toast.error(err.message ?? "An unexpected error occurred");
      }
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* Step indicator pills */}
        <div className="flex gap-1.5" aria-label={`Step ${currentStep + 1} of ${STEPS.length}`}>
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${index <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              aria-hidden="true"
            />
          ))}
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl text-primary">
              Worker KYC — Step {currentStep + 1}/{STEPS.length}: {stepTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={currentStep === 0 ? "block" : "hidden"}>
              <Step0 />
            </div>
            <div className={currentStep === 1 ? "block" : "hidden"}>
              <Step1 />
            </div>
            <div className={currentStep === 2 ? "block" : "hidden"}>
              <Step2 />
            </div>
            <div className={currentStep === 3 ? "block" : "hidden"}>
              <Step3 />
            </div>
            <div className={currentStep === 4 ? "block" : "hidden"}>
              <Step4 />
            </div>
          </CardContent>
        </Card>

        {Object.keys(form.formState.errors).length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Cannot submit — please fix:</p>
            <ul className="list-disc pl-5">
              {Object.entries(form.formState.errors).map(([k, v]) => (
                <li key={k}>
                  {k}: {(v as { message?: string } | undefined)?.message ?? "invalid"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <Button type="button" variant="outline" disabled={!canGoBack} onClick={prevStep}>
            Back
          </Button>
          {canGoNext ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting…" : "Submit KYC"}
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
