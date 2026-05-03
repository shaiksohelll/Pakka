import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "./bottom-nav";
import { Button } from "@/components/ui/button";

interface PageShellProps {
  title?: string;
  back?: string | boolean;
  role?: "client" | "worker";
  children: ReactNode;
  headerRight?: ReactNode;
  noPadding?: boolean;
}

export function PageShell({
  title,
  back,
  role,
  children,
  headerRight,
  noPadding,
}: PageShellProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {(title || back) && (
        <header className="sticky top-0 z-30 bg-background border-b border-border px-4 h-14 flex items-center gap-2 shrink-0">
          {back && (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-9 w-9"
              onClick={() =>
                typeof back === "string" ? navigate(back) : history.back()
              }
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {title && (
            <h1 className="font-semibold text-base flex-1 truncate">{title}</h1>
          )}
          {headerRight && <div className="ml-auto">{headerRight}</div>}
        </header>
      )}
      <main className={`flex-1 ${role ? "pb-20" : ""} ${noPadding ? "" : ""}`}>
        {children}
      </main>
      {role && <BottomNav role={role} />}
    </div>
  );
}
