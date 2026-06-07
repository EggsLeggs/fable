import { ShieldCheck } from "lucide-react";

export default function QaPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">QA Checks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Automated quality checks for your translations.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">Coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            QA checks via AI and admins are on the roadmap.
          </p>
        </div>
      </div>
    </div>
  );
}
