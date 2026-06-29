import { SeverityLevel, SEVERITY_ORDER } from "@/lib/severity";
import { StackedBar } from "./StackedBar";

export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  CRITICAL: "#C4453B",
  HIGH: "#E2725B",
  MEDIUM: "#C98A1D",
  LOW: "#0F9D8C",
  UNKNOWN: "#9AA3AC",
};

export function SeverityBar({
  counts,
  className = "",
}: {
  counts: Record<SeverityLevel, number>;
  className?: string;
}) {
  return (
    <StackedBar
      className={className}
      segments={SEVERITY_ORDER.map((level) => ({
        key: level,
        count: counts[level],
        color: SEVERITY_COLOR[level],
        label: level,
      }))}
    />
  );
}
