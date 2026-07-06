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

/** Groups OSV ids that are aliases of one another (CVE/GHSA/PYSEC/... all
 *  describing the same underlying vulnerability) into a single canonical id,
 *  so counting logic doesn't treat each alias as a separate finding. */
export type VulnIndex = {
  canonicalId: (id: string) => string;
  representative: (canonicalId: string) => OsvVuln | undefined;
  severityOf: (canonicalId: string) => SeverityLevel;
  membersOf: (canonicalId: string) => string[];
};

export function buildVulnIndex(db: Record<string, OsvVuln>): VulnIndex {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const id of Object.keys(db)) find(id);
  for (const [id, vuln] of Object.entries(db)) {
    for (const alias of vuln.aliases ?? []) union(id, alias);
  }

  const membersByRoot = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = membersByRoot.get(root);
    if (list) list.push(id);
    else membersByRoot.set(root, [id]);
  }

  const representativeByRoot = new Map<string, OsvVuln | undefined>();
  const severityByRoot = new Map<string, SeverityLevel>();
  for (const [root, members] of membersByRoot) {
    const known = members.filter((m) => db[m]);
    // Prefer a CVE id for the representative — most legible for a paper/report.
    const repId = known.find((m) => m.startsWith("CVE-")) ?? known.sort()[0] ?? root;
    representativeByRoot.set(root, db[repId]);

    let worst: SeverityLevel = "UNKNOWN";
    for (const m of known) {
      const s = severityOf(db[m]);
      if (SEVERITY_ORDER.indexOf(s) < SEVERITY_ORDER.indexOf(worst)) worst = s;
    }
    severityByRoot.set(root, worst);
  }

  return {
    canonicalId: (id: string) => find(id),
    representative: (canonicalId: string) => representativeByRoot.get(canonicalId),
    severityOf: (canonicalId: string) => severityByRoot.get(canonicalId) ?? "UNKNOWN",
    membersOf: (canonicalId: string) => membersByRoot.get(canonicalId) ?? [canonicalId],
  };
}

/** (canonical vuln, component name, component version) is the unit of counting —
 *  the same CVE hitting the same library@version via multiple SBOM entries
 *  (monorepo lockfiles, transitive duplicates, ...) is one finding. */
function affectedKeys(report: SlugVulnReport, index: VulnIndex): Set<string> {
  const keys = new Set<string>();
  for (const c of report.affected) {
    for (const id of c.vulnIds) {
      keys.add(`${index.canonicalId(id)}::${c.name}::${c.version ?? ""}`);
    }
  }
  return keys;
}

export function summarizeReport(
  slug: string,
  report: SlugVulnReport,
  db: Record<string, OsvVuln>,
  index: VulnIndex = buildVulnIndex(db)
): VulnSummary {
  const bySeverity: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };
  const keys = affectedKeys(report, index);
  for (const key of keys) {
    const canonicalId = key.split("::")[0];
    bySeverity[index.severityOf(canonicalId)]++;
  }

  return {
    slug,
    scannedAt: report.scannedAt,
    affectedComponentCount: report.affected.length,
    vulnCount: keys.size,
    bySeverity,
  };
}

/** Ecosystem-wide dedup: the same (vuln, component, version) showing up in many
 *  different projects' dependency trees is one distinct vulnerable instance,
 *  not one per project. Summing per-project counts instead inflates the total
 *  by however many projects happen to share that dependency. */
export function summarizeAcrossReports(
  reports: SlugVulnReport[],
  db: Record<string, OsvVuln>,
  index: VulnIndex = buildVulnIndex(db)
): { vulnCount: number; bySeverity: Record<SeverityLevel, number> } {
  const bySeverity: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };
  const seen = new Set<string>();
  for (const report of reports) {
    for (const key of affectedKeys(report, index)) {
      if (seen.has(key)) continue;
      seen.add(key);
      bySeverity[index.severityOf(key.split("::")[0])]++;
    }
  }
  return { vulnCount: seen.size, bySeverity };
}
