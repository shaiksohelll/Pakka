"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { postJobAction } from "@/app/_actions/jobs";
import { postJobSchema, JOB_CATEGORIES, CATEGORY_LABELS, type PostJobInput } from "@/lib/schemas/jobs";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Basics", step: 1 },
  { label: "Location", step: 2 },
  { label: "Budget", step: 3 },
  { label: "Milestones", step: 4 },
  { label: "Materials", step: 5 },
  { label: "Review", step: 6 },
] as const;

type FieldError = { message?: string };

export function PostJobForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  const form = useForm<PostJobInput>({
    resolver: zodResolver(postJobSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      category: undefined,
      description: "",
      location_text: "",
      lat: undefined,
      lng: undefined,
      total_budget: undefined,
      milestones: [{ title: "", description: "", amount: undefined as unknown as number }],
      materials: [],
    },
  });

  const {
    register,
    formState: { errors },
    watch,
    setValue,
    trigger,
    handleSubmit,
    control,
  } = form;

  const {
    fields: milestoneFields,
    append: appendMilestone,
    remove: removeMilestone,
  } = useFieldArray({ control, name: "milestones" });

  const {
    fields: materialFields,
    append: appendMaterial,
    remove: removeMaterial,
  } = useFieldArray({ control, name: "materials" });

  const totalBudget = watch("total_budget") ?? 0;
  const milestones = watch("milestones");
  const milestoneSum = milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const budgetDiff = totalBudget - milestoneSum;

  // ── Geo ───────────────────────────────────────────────────────────────────
  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser.");
      return;
    }
    setIsGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("lat", pos.coords.latitude, { shouldValidate: true });
        setValue("lng", pos.coords.longitude, { shouldValidate: true });
        toast.success("Location captured!");
        setIsGeoLoading(false);
      },
      () => {
        toast.error("Could not get location. Enter coordinates manually.");
        setIsGeoLoading(false);
      },
    );
  }, [setValue]);

  // ── Step navigation ───────────────────────────────────────────────────────
  const STEP_FIELDS: Record<number, (keyof PostJobInput)[]> = {
    1: ["title", "category", "description"],
    2: ["location_text"],
    3: ["total_budget"],
    4: ["milestones"],
    5: [],
    6: [],
  };

  async function goNext() {
    const fields = STEP_FIELDS[step] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await trigger(fields as any);
    if (!valid) return;
    setStep((s) => Math.min(s + 1, 6));
  }

  function goPrev() {
    setStep((s) => Math.max(s - 1, 1));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await postJobAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Job posted successfully!");
      router.push(`/client/jobs/${result.data?.jobId}`);
    });
  });

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Step progress */}
      <div className="sticky top-0 z-10 bg-background/95 pb-3 pt-4 backdrop-blur">
        <Progress value={(step / 6) * 100} className="h-1.5 rounded-full" />
        <div className="mt-2 flex justify-between">
          {STEPS.map(({ label, step: s }) => (
            <span
              key={s}
              className={cn(
                "text-[10px] font-medium",
                s === step
                  ? "text-primary"
                  : s < step
                    ? "text-emerald-600"
                    : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pb-36">
        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Job Basics</h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                placeholder="e.g. Fix bathroom tiles"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch("category") ?? ""}
                onValueChange={(v) =>
                  setValue("category", v as PostJobInput["category"], { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category">
                    {watch("category")
                      ? CATEGORY_LABELS[watch("category")!]
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {JOB_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the work in detail (min 20 characters)"
                rows={5}
                {...register("description")}
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {watch("description")?.length ?? 0} / 2000
              </p>
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Location ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Job Location</h2>

            <div className="space-y-1.5">
              <Label htmlFor="location_text">City / Area</Label>
              <Input
                id="location_text"
                placeholder="e.g. Banjara Hills, Hyderabad"
                {...register("location_text")}
              />
              {errors.location_text && (
                <p className="text-xs text-destructive">{errors.location_text.message}</p>
              )}
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground">
              Optionally share your precise location so nearby workers can find you.
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={requestGeo}
              disabled={isGeoLoading}
            >
              {isGeoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {isGeoLoading ? "Getting location…" : "Use My Location"}
            </Button>

            {watch("lat") && watch("lng") && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                📍 Lat {watch("lat")?.toFixed(5)}, Lng {watch("lng")?.toFixed(5)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lat">Latitude (optional)</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  placeholder="17.385044"
                  value={watch("lat") ?? ""}
                  onChange={(e) =>
                    setValue("lat", e.target.value ? parseFloat(e.target.value) : undefined, {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lng">Longitude (optional)</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  placeholder="78.486671"
                  value={watch("lng") ?? ""}
                  onChange={(e) =>
                    setValue("lng", e.target.value ? parseFloat(e.target.value) : undefined, {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Budget ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Budget</h2>

            <div className="space-y-1.5">
              <Label htmlFor="total_budget">Total Budget (INR)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="total_budget"
                  type="number"
                  className="pl-7"
                  placeholder="50000"
                  value={watch("total_budget") ?? ""}
                  onChange={(e) =>
                    setValue(
                      "total_budget",
                      e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
                      { shouldValidate: true },
                    )
                  }
                />
              </div>
              {errors.total_budget && (
                <p className="text-xs text-destructive">{errors.total_budget.message}</p>
              )}
              {totalBudget > 0 && (
                <p className="text-sm font-medium text-primary">
                  = {formatInr(totalBudget)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Milestones ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Milestones</h2>
            <p className="text-sm text-muted-foreground">
              Break the job into payment milestones. They must sum to{" "}
              <strong>{formatInr(totalBudget)}</strong>.
            </p>

            {/* Running total */}
            <div
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium",
                Math.abs(budgetDiff) < 1
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {Math.abs(budgetDiff) < 1
                ? "✓ Milestone amounts match budget"
                : budgetDiff > 0
                  ? `${formatInr(budgetDiff)} still unallocated`
                  : `${formatInr(Math.abs(budgetDiff))} over budget`}
            </div>

            {milestoneFields.map((field, i) => (
              <div key={field.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Milestone {i + 1}
                  </span>
                  {milestoneFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="text-destructive hover:opacity-70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`ms-title-${i}`}>Title</Label>
                  <Input
                    id={`ms-title-${i}`}
                    placeholder="e.g. Foundation work"
                    {...register(`milestones.${i}.title`)}
                  />
                  {(errors.milestones?.[i] as { title?: FieldError })?.title && (
                    <p className="text-xs text-destructive">
                      {(errors.milestones?.[i] as { title?: FieldError })?.title?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`ms-desc-${i}`}>Description (optional)</Label>
                  <Input
                    id={`ms-desc-${i}`}
                    placeholder="Details about this milestone"
                    {...register(`milestones.${i}.description`)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`ms-amt-${i}`}>Amount (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id={`ms-amt-${i}`}
                      type="number"
                      className="pl-7"
                      placeholder="10000"
                      value={watch(`milestones.${i}.amount`) ?? ""}
                      onChange={(e) =>
                        setValue(
                          `milestones.${i}.amount`,
                          e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
                          { shouldValidate: true },
                        )
                      }
                    />
                  </div>
                  {(errors.milestones?.[i] as { amount?: FieldError })?.amount && (
                    <p className="text-xs text-destructive">
                      {(errors.milestones?.[i] as { amount?: FieldError })?.amount?.message}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {milestoneFields.length < 8 && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() =>
                  appendMilestone({ title: "", description: "", amount: undefined as unknown as number })
                }
              >
                <Plus className="h-4 w-4" />
                Add Milestone
              </Button>
            )}

            {errors.milestones?.root && (
              <p className="text-xs text-destructive">{errors.milestones.root.message}</p>
            )}
          </div>
        )}

        {/* ── Step 5: Materials ── */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">Materials</h2>
            <p className="text-sm text-muted-foreground">
              Optional: list materials needed for this job.
            </p>

            {materialFields.map((field, i) => (
              <div key={field.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Material {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMaterial(i)}
                    className="text-destructive hover:opacity-70"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`mat-vendor-${i}`}>Vendor</Label>
                    <Input
                      id={`mat-vendor-${i}`}
                      placeholder="Vendor name"
                      {...register(`materials.${i}.vendor_name`)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`mat-item-${i}`}>Item</Label>
                    <Input
                      id={`mat-item-${i}`}
                      placeholder="Item name"
                      {...register(`materials.${i}.item_name`)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`mat-qty-${i}`}>Qty</Label>
                    <Input
                      id={`mat-qty-${i}`}
                      type="number"
                      step="0.01"
                      placeholder="10"
                      value={watch(`materials.${i}.qty`) ?? ""}
                      onChange={(e) =>
                        setValue(
                          `materials.${i}.qty`,
                          e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
                          { shouldValidate: true },
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`mat-amt-${i}`}>Amount (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        ₹
                      </span>
                      <Input
                        id={`mat-amt-${i}`}
                        type="number"
                        className="pl-7"
                        placeholder="500"
                        value={watch(`materials.${i}.amount`) ?? ""}
                        onChange={(e) =>
                          setValue(
                            `materials.${i}.amount`,
                            e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
                            { shouldValidate: true },
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() =>
                appendMaterial({ vendor_name: "", item_name: "", qty: undefined as unknown as number, amount: undefined as unknown as number })
              }
            >
              <Plus className="h-4 w-4" />
              Add Material
            </Button>

            {materialFields.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No materials added. Tap &quot;Add Material&quot; or skip to review.
              </p>
            )}
          </div>
        )}

        {/* ── Step 6: Review ── */}
        {step === 6 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-primary">Review &amp; Post</h2>

            <ReviewSection label="Job Title">{watch("title")}</ReviewSection>
            <ReviewSection label="Category">
              {CATEGORY_LABELS[watch("category")] ?? watch("category")}
            </ReviewSection>
            <ReviewSection label="Description">
              <p className="whitespace-pre-wrap text-sm">{watch("description")}</p>
            </ReviewSection>
            <ReviewSection label="Location">{watch("location_text")}</ReviewSection>
            <ReviewSection label="Total Budget">
              <span className="text-lg font-bold text-primary">
                {formatInr(totalBudget)}
              </span>
            </ReviewSection>

            <ReviewSection label={`Milestones (${milestones.length})`}>
              <ol className="space-y-2">
                {milestones.map((m, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>
                      {i + 1}. {m.title}
                    </span>
                    <span className="font-medium">{formatInr(Number(m.amount) || 0)}</span>
                  </li>
                ))}
              </ol>
            </ReviewSection>

            {watch("materials")!.length > 0 && (
              <ReviewSection label={`Materials (${watch("materials")!.length})`}>
                <ol className="space-y-1">
                  {watch("materials")!.map((mat, i) => (
                    <li key={i} className="text-sm">
                      {mat.vendor_name} — {mat.item_name} × {mat.qty} ={" "}
                      {formatInr(Number(mat.amount) || 0)}
                    </li>
                  ))}
                </ol>
              </ReviewSection>
            )}
          </div>
        )}
      </form>

      {/* ── Sticky CTA ── */}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t bg-background/95 px-4 py-4 backdrop-blur max-w-[640px] mx-auto">
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {step < 6 ? (
            <Button type="button" className="flex-1 gap-1" onClick={goNext}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={onSubmit}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Posting…" : "Post Job"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
