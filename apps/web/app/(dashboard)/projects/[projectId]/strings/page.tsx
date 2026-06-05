"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

type Props = { params: Promise<{ projectId: string }> };

export default function StringsRedirectPage({ params }: Props) {
  const { projectId } = use(params);
  const router = useRouter();

  const projectQuery = trpc.project.getById.useQuery({ id: projectId });
  const project = projectQuery.data;

  useEffect(() => {
    if (!project) return;
    const targetLocales = project.locales.filter((l) => !l.isSource);
    const first = targetLocales[0] ?? project.locales[0];
    if (first) {
      router.replace(`/projects/${projectId}/strings/${first.locale}`);
    }
  }, [project, projectId, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
