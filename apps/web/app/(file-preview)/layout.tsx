import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function FilePreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
