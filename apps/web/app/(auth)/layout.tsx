import { PatternedBackground } from "@/components/PatternedBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-muted">
      <div className="relative z-10">{children}</div>
      <PatternedBackground className="z-0 opacity-50" />
    </div>
  );
}
