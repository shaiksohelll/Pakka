import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getJobs } from "@/actions/jobs";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { CATEGORIES } from "@/lib/schemas/jobs";

export default function WorkerFeed() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState<string>("");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["worker-feed", category],
    queryFn: () =>
      getJobs({ status: "open", ...(category ? { category } : {}) }),
  });

  return (
    <PageShell title="Job Feed" role="worker">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={category}
            onValueChange={(v) => setCategory(v === "all" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : jobs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="text-5xl">🔍</div>
            <p className="font-medium">No open jobs right now</p>
            <p className="text-sm text-muted-foreground">Check back later or try a different category</p>
          </div>
        ) : (
          jobs?.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/worker/jobs/${job.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-snug flex-1">{job.title}</p>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                    {CATEGORY_LABELS[job.category] ?? job.category}
                  </span>
                  <span className="font-bold text-primary text-sm">{formatInr(job.total_budget)}</span>
                </div>
                {job.location_text && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {job.location_text}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {job.profiles?.name && (
                    <p className="text-xs text-muted-foreground">by {job.profiles.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{relativeTime(job.created_at)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
