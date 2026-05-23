import { ClientNavShell } from "@/components/nav/client-nav-shell";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientNavShell>{children}</ClientNavShell>;
}
