import { Link, useLocation } from "wouter";
import { Briefcase, Home, Wallet, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  role: "client" | "worker";
}

const clientLinks = [
  { href: "/client/jobs", label: "Jobs", icon: Briefcase },
  { href: "/client/wallet", label: "Wallet", icon: Wallet },
];

const workerLinks = [
  { href: "/worker/feed", label: "Feed", icon: Home },
  { href: "/worker/applications", label: "Applied", icon: ClipboardList },
  { href: "/worker/wallet", label: "Wallet", icon: Wallet },
];

export function BottomNav({ role }: BottomNavProps) {
  const [location] = useLocation();
  const links = role === "client" ? clientLinks : workerLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs px-6 py-2 transition-colors rounded-lg",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
