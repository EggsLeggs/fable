import {
  AlertTriangle,
  Ban,
  Circle,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const SCENARIO_CATEGORIES = [
  "success",
  "safety",
  "muted",
  "warning",
  "blocked",
] as const;

export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export const scenarioCategoryConfig: Record<
  ScenarioCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  success: { label: "High intent", icon: TrendingUp, className: "text-emerald-500" },
  safety: { label: "Brand safety", icon: ShieldAlert, className: "text-red-500" },
  muted: { label: "Low intent", icon: Circle, className: "text-muted-foreground" },
  warning: { label: "Medium intent", icon: AlertTriangle, className: "text-amber-500" },
  blocked: { label: "Blocked topic", icon: Ban, className: "text-red-500" },
};

export function isScenarioCategory(value: string): value is ScenarioCategory {
  return (SCENARIO_CATEGORIES as readonly string[]).includes(value);
}
