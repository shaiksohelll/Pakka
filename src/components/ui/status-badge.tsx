"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
  // Job statuses
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "disputed"
  // Milestone statuses
  | "pending"
  | "funded"
  | "submitted"
  | "approved"
  | "released"
  | "refunded"
  // Application statuses
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn"
  // Material statuses
  | "requested"
  | "paid"
  | "delivered"
  // Trust tiers
  | "bronze"
  | "silver"
  | "gold"
  // KYC
  | "verified";

const VARIANT_MAP: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  // Job
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  assigned: { label: "Assigned", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "In Progress", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  completed: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
  disputed: { label: "Disputed", className: "bg-orange-50 text-orange-700 border-orange-200" },
  // Milestone
  pending: { label: "Pending", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  funded: { label: "Funded", className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  submitted: { label: "Submitted", className: "bg-purple-50 text-purple-700 border-purple-200" },
  approved: { label: "Approved", className: "bg-teal-50 text-teal-700 border-teal-200" },
  released: { label: "Released", className: "bg-green-50 text-green-700 border-green-200" },
  refunded: { label: "Refunded", className: "bg-rose-50 text-rose-700 border-rose-200" },
  // Application
  shortlisted: { label: "Shortlisted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  accepted: { label: "Accepted", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-600 border-red-200" },
  withdrawn: { label: "Withdrawn", className: "bg-gray-100 text-gray-600 border-gray-200" },
  // Material
  requested: { label: "Requested", className: "bg-sky-50 text-sky-700 border-sky-200" },
  paid: { label: "Paid", className: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Delivered", className: "bg-green-50 text-green-700 border-green-200" },
  // Trust
  bronze: { label: "Bronze", className: "bg-amber-50 text-amber-700 border-amber-200" },
  silver: { label: "Silver", className: "bg-slate-100 text-slate-600 border-slate-300" },
  gold: { label: "Gold", className: "bg-yellow-50 text-yellow-600 border-yellow-300" },
  // KYC
  verified: { label: "Verified", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

type StatusBadgeProps = {
  variant: StatusVariant;
  className?: string;
};

export function StatusBadge({ variant, className }: StatusBadgeProps) {
  const config = VARIANT_MAP[variant] ?? { label: variant, className: "bg-gray-100 text-gray-700" };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium capitalize", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
