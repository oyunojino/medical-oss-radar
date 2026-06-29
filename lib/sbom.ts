import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SBOM_DIR = path.join(process.cwd(), "sboms");

export type CdxComponent = {
  type: string;
  name: string;
  version?: string;
  purl?: string;
  licenses?: { license?: { id?: string; name?: string } }[];
};

type CdxDocument = {
  specVersion?: string;
  metadata?: { timestamp?: string };
  components?: CdxComponent[];
};

export type EcosystemCount = { name: string; count: number };

export type SbomSummary = {
  slug: string;
  specVersion?: string;
  generatedAt?: string;
  componentCount: number;
  licenseCount: number;
  ecosystems: EcosystemCount[];
};

function purlEcosystem(purl?: string): string {
  // pkg:npm/foo@1.0.0 -> "npm"
  const m = purl?.match(/^pkg:([a-zA-Z0-9.+-]+)\//);
  return m ? m[1] : "unknown";
}

function licenseId(c: CdxComponent): string[] {
  return (c.licenses ?? [])
    .map((l) => l.license?.id || l.license?.name)
    .filter((v): v is string => Boolean(v));
}

/** Slugs that have at least a CycloneDX SBOM on disk, sorted alphabetically. */
export async function listSbomSlugs(): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(SBOM_DIR);
  } catch {
    return [];
  }
  const slugs = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(.+)\.cdx\.json$/);
    if (m) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

export async function readCdx(slug: string): Promise<CdxDocument | null> {
  try {
    const text = await readFile(path.join(SBOM_DIR, `${slug}.cdx.json`), "utf8");
    return JSON.parse(text) as CdxDocument;
  } catch {
    return null;
  }
}

export async function hasSpdx(slug: string): Promise<boolean> {
  try {
    await readFile(path.join(SBOM_DIR, `${slug}.spdx.json`), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function summarize(slug: string, cdx: CdxDocument): SbomSummary {
  const components = cdx.components ?? [];
  const ecoCount = new Map<string, number>();
  const licenses = new Set<string>();

  for (const c of components) {
    const eco = purlEcosystem(c.purl);
    ecoCount.set(eco, (ecoCount.get(eco) ?? 0) + 1);
    for (const l of licenseId(c)) licenses.add(l);
  }

  return {
    slug,
    specVersion: cdx.specVersion,
    generatedAt: cdx.metadata?.timestamp,
    componentCount: components.length,
    licenseCount: licenses.size,
    ecosystems: [...ecoCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function sortedComponents(cdx: CdxDocument): CdxComponent[] {
  return [...(cdx.components ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}
