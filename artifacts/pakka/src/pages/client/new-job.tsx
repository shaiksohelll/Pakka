import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { CityAreaFields } from "@/components/forms/city-area-fields";
import { useUser } from "@/hooks/use-user";
import { createJob } from "@/actions/jobs";
import { jobSchema, CATEGORIES, type JobFormValues } from "@/lib/schemas/jobs";
import { CATEGORY_LABELS } from "@/lib/format";

export default function NewJob() {
  const [, navigate] = useLocation();
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      description: "",
      category: undefined,
      budget: undefined,
      city: "",
      area: "",
      lat: null,
      lng: null,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: JobFormValues) =>
      createJob({
        title: values.title,
        description: values.description,
        category: values.category,
        budget: values.budget,
        city: values.city,
        area: values.area,
        lat: values.lat,
        lng: values.lng,
        client_id: user!.id,
      }),
    onSuccess: () => {
      toast.success("Job posted successfully!");
      qc.invalidateQueries({ queryKey: ["client-jobs"] });
      navigate("/client/jobs");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsGeoLoading(true);

    const geoPromise = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000,
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), 10_000)
    );

    Promise.race([geoPromise, timeoutPromise])
      .then((pos) => {
        form.setValue("lat", pos.coords.latitude, { shouldValidate: true });
        form.setValue("lng", pos.coords.longitude, { shouldValidate: true });
        toast.success("Location pinned!");
      })
      .catch((err: unknown) => {
        if (
          err instanceof GeolocationPositionError &&
          err.code === GeolocationPositionError.PERMISSION_DENIED
        ) {
          toast.error("Location permission denied. Enter manually.");
        } else {
          toast.error("Couldn't determine location. Enter manually.");
        }
      })
      .finally(() => setIsGeoLoading(false));
  }, [form]);

  const lat = form.watch("lat");
  const lng = form.watch("lng");

  return (
    <PageShell title="Post a Job" back="/client/jobs" role="client">
      <div className="p-4">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Job Details
              </p>

              <div className="space-y-1">
                <Label htmlFor="title">
                  Job Title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" placeholder="e.g. Fix leaking kitchen tap" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the work in detail — what needs to be done, any materials required, etc."
                  rows={4}
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) => form.setValue("category", v as JobFormValues["category"], { shouldValidate: true })}
                  value={form.watch("category")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat] ?? cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="budget">
                  Budget (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="budget"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 2500"
                  {...form.register("budget")}
                />
                {form.formState.errors.budget && (
                  <p className="text-xs text-destructive">{form.formState.errors.budget.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Location
              </p>

              <CityAreaFields form={form} />

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">GPS Pin (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={isGeoLoading}
                  onClick={requestGeo}
                >
                  {isGeoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {isGeoLoading ? "Getting location…" : "Use My Current Location"}
                </Button>
                {lat != null && lng != null && (
                  <p className="text-xs text-muted-foreground text-center">
                    📍 {lat.toFixed(5)}, {lng.toFixed(5)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={mutation.isPending || !user}
          >
            {mutation.isPending ? "Posting…" : "Post Job"}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
