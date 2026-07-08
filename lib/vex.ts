// VEX (Vulnerability Exploitability eXchange) status, read side. Written by
// scripts/vex-scan.mjs — see that file for how status/evidence are derived.
// Pure types first (client-safe, mirrors lib/severity.ts), fs-backed readers
// below (mirrors lib/osv.ts's readSlugReport/listVulnSlugs).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { VulnIndex } from "./osv";

export type VexStatus = "under_investigation" | "affected" | "not_affected";

/** CISA/CycloneDX VEX justification codes for a `not_affected` status. Only
 *  "vulnerable_code_not_present" is produced by scripts/vex-scan.mjs today —
 *  the rest are declared for forward-compat with the schema but never set. */
export type VexJustification =
  | "vulnerable_code_not_present"
  | "component_not_present"
  | "vulnerable_code_not_in_execute_path"
  | "vulnerable_code_cannot_be_controlled_by_adversary"
  | "inline_mitigations_already_exist";

export type VexFixCommit = {
  owner: string;
  repo: string;
  sha: string;
  source: "GIT_RANGE" | "FIX_REF" | "WEB_COMMIT_URL";
  url: string;
};

export type VexEvidence = {
  fixCommits: VexFixCommit[];
  functionNamesChecked: string[];
  filesSearched: number;
  filesSkippedMinified: number;
  packageSourceUrl: string | null;
  reason: string | null;
};

export type VexEntry = {
  componentName: string;
  componentVersion: string;
  purl: string;
  vulnId: string;
  status: VexStatus;
  justification: VexJustification | null;
  /** True once automation attempted a determination for this pair (even if it
   *  bailed to under_investigation). False/absent-from-file means "never
   *  eligible" — the UI must not conflate the two (see app/vulnerabilities). */
  attempted: boolean;
  checkedAt: string;
  osvModifiedAtCheck: string | null;
  evidence: VexEvidence;
};

export type SlugVexReport = {
  slug: string;
  scannedAt: string;
  entries: VexEntry[];
};

const VEX_DIR = path.join(process.cwd(), "vex");

/** Slugs covered by the VEX pilot (i.e. `npm run vex` has processed them) —
 *  a strict subset of listVulnSlugs(), since this is top-N pilot-scoped. */
export async function listVexSlugs(): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(VEX_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export async function readSlugVex(slug: string): Promise<SlugVexReport | null> {
  try {
    const text = await readFile(path.join(VEX_DIR, `${slug}.json`), "utf8");
    return JSON.parse(text) as SlugVexReport;
  } catch {
    return null;
  }
}

/** Keyed by componentName::componentVersion::vulnId — matches how
 *  scripts/vex-scan.mjs records entries (raw OSV id, not alias-canonicalized). */
export function indexVexEntries(report: SlugVexReport | null): Map<string, VexEntry> {
  const map = new Map<string, VexEntry>();
  if (!report) return map;
  for (const e of report.entries) {
    map.set(`${e.componentName}::${e.componentVersion}::${e.vulnId}`, e);
  }
  return map;
}

/** The vuln detail page groups aliases under one canonical id (lib/osv.ts's
 *  VulnIndex), but a VexEntry is keyed by whichever single raw OSV id
 *  vex-scan.mjs happened to use as evidence — so look up by canonical id via
 *  its alias members, not by exact id match. */
export function findVexForCanonical(
  vexMap: Map<string, VexEntry>,
  index: VulnIndex,
  canonicalId: string,
  componentName: string,
  componentVersion: string
): VexEntry | undefined {
  for (const memberId of index.membersOf(canonicalId)) {
    const hit = vexMap.get(`${componentName}::${componentVersion}::${memberId}`);
    if (hit) return hit;
  }
  return undefined;
}
