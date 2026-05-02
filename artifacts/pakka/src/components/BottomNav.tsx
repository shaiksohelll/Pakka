import { useLocation } from "wouter";
import { Briefcase, Plus, Wallet, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIENT_TABS = [
  { label: "Jobs", href: "/client/jobs", icon: Briefcase },
  { label: "New Job", href: "/client/jobs/new", icon: Plus },
  { label: "Wallet", href: "/client/wallet", icon: Wallet },
];

const WORKER_TABS = [
  { label: "Feed", href: "/worker/feed", icon: Search },
  { label: "Applications", href: "/worker/applications", icon: FileText },
  { label: "Wallet", href: "/worker/wallet", icon: Wallet },
];

export function BottomNav() {
  const [location, navigate] = useLocation();

  const isClient = location.startsWith("/client");
  const isWorker = location.startsWith("/worker");

  if (!isClient && !isWorker) return null;

  const tabs = isClient ? CLIENT_TABS : WORKER_TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[#0a2540]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[640px] items-center justify-around">
        {tabs.map(({ label, href, icon: Icon }) => {
          const isActive = location === href || (href !== "/client/jobs/new" && location.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-[#10b981]"
                  : "text-white/60 hover:text-white/90"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-[#10b981]" : "text-white/60"
                )}
              />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
