import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
