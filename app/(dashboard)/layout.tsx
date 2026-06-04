import { AppShell, dashboardContentClassName } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell contentClassName={dashboardContentClassName}>{children}</AppShell>;
}
