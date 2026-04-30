"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, FileText, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Browse", href: "/worker/feed",         Icon: Search   },
  { label: "My Jobs", href: "/worker/applications", Icon: FileText },
  { label: "Wallet",  href: "/worker/wallet",       Icon: Wallet   },
  { label: "Account", href: "/worker/account",      Icon: User     },
] as const;

export function WorkerNavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Page content — add bottom padding so nothing hides behind the nav */}
      <div className="pb-16">{children}</div>

      {/* ── Sticky bottom tab bar ── */}
      <nav
        aria-label="Worker navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur",
          "max-w-[640px] mx-auto",
        )}
      >
        <ul className="flex h-14 items-stretch">
          {TABS.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  id={`worker-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    // Base tap-target: 48px tall, full width
                    "flex h-12 w-full flex-col items-center justify-center gap-0.5",
                    "rounded-md text-xs font-medium transition-opacity duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    "hover:opacity-80",
                    "@media (prefers-reduced-motion: reduce) transition-none",
                    active
                      ? "text-emerald-500"
                      : "text-neutral-500",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-emerald-500" : "text-neutral-500",
                    )}
                    aria-hidden
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
