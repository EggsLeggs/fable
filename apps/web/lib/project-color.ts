// Vibrant backgrounds chosen for strong contrast with black text (WCAG AA on bold initials).
const PROJECT_COLORS = [
  "#FFD166",
  "#F4A261",
  "#E9C46A",
  "#90BE6D",
  "#52B788",
  "#8ECAE6",
  "#7BDFF2",
  "#BDB2FF",
  "#CDB4DB",
  "#FFC6FF",
  "#FFADAD",
  "#FDFFB6",
  "#CAFFBF",
  "#9BF6FF",
  "#A0C4FF",
  "#FFDAC1",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getProjectColor(projectId: string): string {
  return PROJECT_COLORS[hashString(projectId) % PROJECT_COLORS.length];
}
