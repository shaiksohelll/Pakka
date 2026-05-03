import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open:        { label: "Open",        className: "bg-blue-100 text-blue-800 border-blue-200" },
  assigned:    { label: "Assigned",    className: "bg-purple-100 text-purple-800 border-purple-200" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  completed:   { label: "Completed",   className: "bg-green-100 text-green-800 border-green-200" },
  disputed:    { label: "Disputed",    className: "bg-red-100 text-red-800 border-red-200" },
  cancelled:   { label: "Cancelled",   className: "bg-gray-100 text-gray-500 border-gray-200" },
  pending:     { label: "Pending",     className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  funded:      { label: "Funded",      className: "bg-blue-100 text-blue-800 border-blue-200" },
  released:    { label: "Released",    className: "bg-green-100 text-green-800 border-green-200" },
  bronze:      { label: "Bronze",      className: "bg-orange-100 text-orange-800 border-orange-200" },
  silver:      { label: "Silver",      className: "bg-gray-100 text-gray-700 border-gray-300" },
  gold:        { label: "Gold",        className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  approved:    { label: "Approved",    className: "bg-green-100 text-green-800 border-green-200" },
  rejected:    { label: "Rejected",    className: "bg-red-100 text-red-800 border-red-200" },
  accepted:    { label: "Accepted",    className: "bg-green-100 text-green-800 border-green-200" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium capitalize", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
