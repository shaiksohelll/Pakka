import { WorkerNavShell } from "@/components/nav/worker-nav-shell";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <WorkerNavShell>{children}</WorkerNavShell>;
}
