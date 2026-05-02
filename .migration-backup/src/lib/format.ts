// ── Money formatting ──────────────────────────────────────────────────────────
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}

// ── Relative time ─────────────────────────────────────────────────────────────
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ── Category label map ────────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  masonry: "Masonry",
  plumbing: "Plumbing",
  electrical: "Electrical",
  painting: "Painting",
  carpentry: "Carpentry",
  tiling: "Tiling",
  welding: "Welding",
  "ac-repair": "AC Repair",
  "appliance-repair": "Appliance Repair",
  cleaning: "Cleaning",
};

