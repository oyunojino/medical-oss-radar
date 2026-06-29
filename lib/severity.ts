// Pure types/constants shared by server (lib/osv.ts) and client components
// (e.g. VulnDashboard) — no fs access here, so it's safe to import from "use client" code.

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export const SEVERITY_ORDER: SeverityLevel[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
];

export type OsvVuln = {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
  references?: { type: string; url: string }[];
};

function normalizeSeverity(raw?: string): SeverityLevel {
  switch ((raw ?? "").toUpperCase()) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MODERATE":
    case "MEDIUM":
      return "MEDIUM";
    case "LOW":
      return "LOW";
    default:
      return "UNKNOWN";
  }
}

/** OSV doesn't always carry a normalized severity — most ecosystem advisories
 *  (GHSA-backed npm/PyPI/etc.) set `database_specific.severity`; anything else
 *  is reported as UNKNOWN rather than guessed from a raw CVSS vector. */
export function severityOf(vuln?: OsvVuln | null): SeverityLevel {
  return normalizeSeverity(vuln?.database_specific?.severity);
}

export type VulnSummary = {
  slug: string;
  scannedAt?: string;
  affectedComponentCount: number;
  vulnCount: number;
  bySeverity: Record<SeverityLevel, number>;
};

/** Highest severity present, used for sort order on the list page. */
export function worstSeverity(summary: VulnSummary): SeverityLevel {
  for (const level of SEVERITY_ORDER) {
    if (summary.bySeverity[level] > 0) return level;
  }
  return "UNKNOWN";
}
