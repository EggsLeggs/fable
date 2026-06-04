type Status = "bid" | "skip" | "flagged" | "approved" | "vetoed";

const config: Record<
  Status,
  { label: string; textColor: string; borderColor: string; bgColor: string }
> = {
  bid:      { label: "BID",      textColor: "#10b981", borderColor: "#10b98130", bgColor: "#10b98110" },
  skip:     { label: "SKIP",     textColor: "#6b7280", borderColor: "#6b728030", bgColor: "#6b728010" },
  flagged:  { label: "FLAGGED",  textColor: "#ef4444", borderColor: "#ef444430", bgColor: "#ef444410" },
  approved: { label: "APPROVED", textColor: "#6366f1", borderColor: "#6366f130", bgColor: "#6366f110" },
  vetoed:   { label: "VETOED",   textColor: "#f97316", borderColor: "#f9731630", bgColor: "#f9731610" },
};

export function StatusBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium border"
      style={{ color: c.textColor, borderColor: c.borderColor, backgroundColor: c.bgColor }}
    >
      {c.label}
    </span>
  );
}
