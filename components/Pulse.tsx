import { VitalStatus } from "@/lib/time";

const PATHS: Record<VitalStatus, string> = {
  // sharp QRS-like spike — "alive", recently pushed
  active: "M0 16 H30 L36 4 L42 28 L48 8 L54 16 H120",
  // gentle single bump — still breathing, but slowing down
  aging: "M0 16 H40 C50 16 50 6 60 6 C70 6 70 16 80 16 H120",
  // flat line — no signal in the last year (or archived)
  dormant: "M0 16 H120",
};

const COLORS: Record<VitalStatus, string> = {
  active: "#0F9D8C",
  aging: "#C98A1D",
  dormant: "#C4453B",
};

export function Pulse({ status }: { status: VitalStatus }) {
  return (
    <svg
      viewBox="0 0 120 32"
      className={`h-5 w-20 ${status === "active" ? "pulse-active" : ""}`}
      aria-hidden="true"
    >
      <path
        d={PATHS[status]}
        fill="none"
        stroke={COLORS[status]}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
