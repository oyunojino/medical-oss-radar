import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  OsvVuln,
  SeverityLevel,
  SEVERITY_ORDER,
  severityOf,
  VulnSummary,
  worstSeverity,
} from "./severity";

export { severityOf, worstSeverity, SEVERITY_ORDER };
export type { OsvVuln, SeverityLevel, VulnSummary };

const VULN_DIR = path.join(process.cwd(), "vulns");
const DB_PATH = path.join(VULN_DIR, "_db.json");

export type AffectedComponent = {
  name: string;
  version?: string;
  purl: string;
  vulnIds: string[];
};

export type SlugVulnReport = {
  slug: string;
  scannedAt: string;
  componentCount: number;
  affected: AffectedComponent[];
};

/** Slugs that have a vulnerability report on disk (i.e. `npm run osv` has scanned them). */
export async function listVulnSlugs(): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(VULN_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export async function readSlugReport(slug: string): Promise<SlugVulnReport | null> {
  try {
    const text = await readFile(path.join(VULN_DIR, `${slug}.json`), "utf8");
    return JSON.parse(text) as SlugVulnReport;
  } catch {
    return null;
  }
}

/** Shared vuln detail cache written by scripts/osv-scan.mjs, keyed by OSV id. */
export async function loadVulnDb(): Promise<Record<string, OsvVuln>> {
  let raw: Record<string, { modified: string; data: OsvVuln }>;
  try {
    raw = JSON.parse(await readFile(DB_PATH, "utf8"));
  } catch {
    return {};
  }
  const out: Record<string, OsvVuln> = {};
  for (const [id, entry] of Object.entries(raw)) out[id] = entry.data;
  return out;
}

export function summarizeReport(
  slug: string,
  report: SlugVulnReport,
  db: Record<string, OsvVuln>
): VulnSummary {
  const bySeverity: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };
  const uniqueIds = new Set<string>();
  for (const c of report.affected) {
    for (const id of c.vulnIds) uniqueIds.add(id);
  }
  for (const id of uniqueIds) bySeverity[severityOf(db[id])]++;

  return {
    slug,
    scannedAt: report.scannedAt,
    affectedComponentCount: report.affected.length,
    vulnCount: uniqueIds.size,
    bySeverity,
  };
}
