"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { MapPin, Loader2, SlidersHorizontal, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/schemas/jobs";

const PAGE_SIZE = 10;

type SortOption = "newest" | "highest_budget";

type FeedJob = {
  id: string;
  title: string;
  category: string;
  location_text: string | null;
  total_budget: number;
  created_at: string;
  milestone_count: number;
};

async function fetchFeedPage({
  pageParam = 0,
  categories,
  sort,
}: {
  pageParam?: number;
  categories: JobCategory[];
  sort: SortOption;
}): Promise<{ jobs: FeedJob[]; nextPage: number | null }> {
  const supabase = createClient();

  let query = supabase
    .from("jobs")
    .select(
      "id, title, category, location_text, total_budget, created_at, milestones(id)",
    )
    .eq("status", "open")
    .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1);

  if (categories.length > 0) {
    query = query.in("category", categories);
  }

  if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("total_budget", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  const jobs = (data ?? []).map((j) => ({
    id: j.id,
    title: j.title,
    category: j.category,
    location_text: j.location_text,
    total_budget: Number(j.total_budget),
    created_at: j.created_at,
    milestone_count: (j.milestones as unknown[]).length,
  }));

  return {
    jobs,
    nextPage: jobs.length === PAGE_SIZE ? pageParam + 1 : null,
  };
}

export function WorkerFeed({ workerKyc }: { workerKyc: "pending" | "verified" | "rejected" }) {
  const [selectedCategories, setSelectedCategories] = useState<JobCategory[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");
  const queryClient = useQueryClient();
  const { user } = useUser();

  // ── Realtime: new open jobs ────────────────────────────────────────────────
  // Fix C: subscribe to INSERT on jobs (status=eq.open) so new postings appear
  // in the feed without a hard refresh.
  // Gate on user?.id so the channel is created AFTER setAuth has run.
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel('worker-feed-jobs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs', filter: 'status=eq.open' },
        () => queryClient.invalidateQueries({ queryKey: ['worker-feed'] }),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        () => queryClient.invalidateQueries({ queryKey: ['worker-feed'] }),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'jobs' },
        () => queryClient.invalidateQueries({ queryKey: ['worker-feed'] }),
      )
      .subscribe((status, err) => {
        console.log('[worker-feed-realtime]', status, err ?? '');
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data: appliedJobIds = new Set<string>() } = useQuery({
    queryKey: ["worker-applied-jobs", user?.id],
    staleTime: 30_000,
    enabled: !!user?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("job_applications")
        .select("job_id")
        .eq("worker_id", user!.id);

      return new Set((data ?? []).map((a) => a.job_id));
    },
  });

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error, status: queryStatus } =
    useInfiniteQuery({
      queryKey: ["worker-feed", selectedCategories, sort],
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      refetchInterval: 60_000, // RLS-aware backstop: realtime UPDATE doesn't fire
      // when a job moves off 'open' (worker loses SELECT
      // access via jobs_select_visible). Poll every 60s.
      queryFn: ({ pageParam }) =>
        fetchFeedPage({ pageParam: pageParam as number, categories: selectedCategories, sort }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextPage,
    });

  console.log("WorkerFeed DEBUG", { selectedCategories, queryStatus, data });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const toggleCategory = (cat: JobCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const allJobs = data?.pages.flatMap((p) => p.jobs) ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Category</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategories([])}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              selectedCategories.length === 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All
          </button>
          {JOB_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedCategories.includes(cat)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          {(["newest", "highest_budget"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                sort === s
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s === "newest" ? "Newest" : "Highest Budget"}
            </button>
          ))}
        </div>
      </div>

      {/* Job list */}
      {isLoading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
          Failed to load jobs. Please refresh.
        </div>
      ) : allJobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold">No open jobs found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {allJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/worker/jobs/${job.id}`}
                  className="flex items-start justify-between rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge variant="open" />
                      <span className="text-xs text-muted-foreground capitalize">
                        {CATEGORY_LABELS[job.category] ?? job.category}
                      </span>
                    </div>
                    <p className="font-semibold leading-snug text-foreground line-clamp-2">
                      {job.title}
                    </p>
                    {job.location_text && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {job.location_text}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">
                        {formatInr(job.total_budget)}
                      </span>
                      <span>
                        {job.milestone_count} milestone{job.milestone_count !== 1 ? "s" : ""}
                      </span>
                      <span>{relativeTime(job.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 ml-3">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    {workerKyc !== "verified" ? (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        KYC required
                      </span>
                    ) : appliedJobIds.has(job.id) ? (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Applied
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!hasNextPage && allJobs.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              You&apos;ve seen all open jobs
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
