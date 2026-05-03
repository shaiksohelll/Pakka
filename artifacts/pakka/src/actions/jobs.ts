import { supabase } from "@/lib/supabase";
import type { Job, Application, Milestone } from "@/lib/types/database";

export interface JobWithClient extends Job {
  profiles: { name: string | null } | null;
}

export async function getJobs(filters?: {
  category?: string;
  status?: string;
  workerId?: string;
  clientId?: string;
}): Promise<JobWithClient[]> {
  let q = supabase
    .from("jobs")
    .select("*, profiles!jobs_client_id_fkey(name)")
    .order("created_at", { ascending: false });
  if (filters?.category) q = q.eq("category", filters.category);
  if (filters?.status) q = q.eq("status", filters.status as string);
  if (filters?.workerId) q = q.eq("worker_id", filters.workerId);
  if (filters?.clientId) q = q.eq("client_id", filters.clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as JobWithClient[];
}

export async function getJob(id: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, client:profiles!jobs_client_id_fkey(name, trust_tier), worker:profiles!jobs_worker_id_fkey(name, trust_tier, kyc_status)"
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createJob(payload: {
  title: string;
  description: string;
  category: string;
  budget: number;
  city: string;
  area: string;
  lat?: number | null;
  lng?: number | null;
  client_id: string;
}): Promise<Job> {
  const location_text = [payload.area, payload.city].filter(Boolean).join(", ");
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      budget: payload.budget,
      location_text,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      client_id: payload.client_id,
      status: "open",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function applyToJob(
  jobId: string,
  workerId: string,
  note: string
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications")
    .insert({ job_id: jobId, worker_id: workerId, note, status: "pending" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Application;
}

export async function getApplicationsForJob(jobId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "*, worker:profiles!applications_worker_id_fkey(name, trust_tier, kyc_status)"
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as (Application & {
    worker: { name: string | null; trust_tier: string | null; kyc_status: string | null };
  })[];
}

export async function getWorkerApplications(workerId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(title, budget, status, category, location_text)")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function acceptApplication(
  applicationId: string,
  jobId: string,
  workerId: string
): Promise<void> {
  const { error: appErr } = await supabase
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId);
  if (appErr) throw new Error(appErr.message);
  const { error: jobErr } = await supabase
    .from("jobs")
    .update({ worker_id: workerId, status: "assigned" })
    .eq("id", jobId);
  if (jobErr) throw new Error(jobErr.message);
  await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("job_id", jobId)
    .neq("id", applicationId);
}

export async function getMilestones(jobId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Milestone[];
}

export async function createMilestone(payload: {
  job_id: string;
  title: string;
  amount: number;
  due_date?: string;
  seq: number;
}): Promise<Milestone> {
  const { data, error } = await supabase
    .from("milestones")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Milestone;
}
