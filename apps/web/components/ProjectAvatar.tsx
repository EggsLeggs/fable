import { cn } from "@/lib/utils";
import { getProjectColor } from "@/lib/project-color";

type Props = {
  projectId: string;
  name: string;
  className?: string;
};

export function ProjectAvatar({ projectId, name, className }: Props) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded font-semibold text-black",
        className,
      )}
      style={{ backgroundColor: getProjectColor(projectId) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
