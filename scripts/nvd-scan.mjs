#!/usr/bin/env node
// Backfills severity for OSV entries that don't carry a normalized
// `database_specific.severity` (common for PyPI/Go/... advisories that skip
// it) by looking up the official CVSS score from NIST's National
// Vulnerability Database (NVD) — the authority that issues CVE ids, as
// opposed to OSV which just aggregates ecosystem advisories.
//
// Purely additive: only fills severities the pipeline would otherwise report
// as UNKNOWN (lib/osv.ts's buildVulnIndex prefers OSV's own severity when
// present and only falls back to this cache).
//
// Usage: npm run nvd
//        npm run nvd -- --force          (redo everything, including cached misses)
//        npm run nvd -- --limit 50       (cap API calls this run)
//
// Optional NVD_API_KEY in .env.local raises the rate limit from 5 to 50
// requests per 30s — get one free at https://nvd.nist.gov/developers/request-an-api-key
// (no key required to use this script, just slower).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VULN_DIR = path.join(ROOT, "vulns");
const DB_PATH = path.join(VULN_DIR, "_db.json");
const NVD_DB_PATH = path.join(VULN_DIR, "_nvd.json");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const UNAUTH_DELAY_MS = 6_500; // NVD: 5 req / 30s without a key
const AUTH_DELAY_MS = 700; // NVD: 50 req / 30s with a key
const CVE_RE = /^CVE-\d{4}-\d+$/;

async function loadEnvLocal() {
  try {
    const text = await readFile(ENV_LOCAL, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env.local — unauthenticated NVD rate limit applies
  }
}

function parseArgs(argv) {
  const opts = { force: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--force") opts.force = true;
    else if (argv[i] === "--limit") opts.limit = Number(argv[++i]) || Infinity;
  }
  return opts;
}

/** Mirrors lib/severity.ts's normalizeSeverity — a CVE only needs an NVD
 *  lookup if OSV left database_specific.severity unset/unrecognized. */
function hasOsvSeverity(vuln) {
  const raw = (vuln.database_specific?.severity ?? "").toUpperCase();
  return ["CRITICAL", "HIGH", "MODERATE", "MEDIUM", "LOW"].includes(raw);
}

/** NVD v2 CVSS scores don't come with a severity label; only v3.x does.
 *  Bands per NVD's published qualitative severity rating scale. */
function bandFromScoreV2(score) {
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  if (score > 0) return "LOW";
  return "UNKNOWN";
}

function extractCvss(cveBody) {
  const metrics = cveBody?.metrics ?? {};
  for (const key of ["cvssMetricV31", "cvssMetricV30"]) {
    const list = metrics[key];
    if (!list?.length) continue;
    const primary = list.find((m) => m.type === "Primary") ?? list[0];
    const data = primary.cvssData;
    if (data?.baseSeverity && data?.baseScore != null) {
      return {
        severity: data.baseSeverity.toUpperCase(),
        baseScore: data.baseScore,
        cvssVersion: data.version ?? key.replace("cvssMetricV", ""),
      };
    }
  }
  const v2 = metrics.cvssMetricV2;
  if (v2?.length) {
    const primary = v2.find((m) => m.type === "Primary") ?? v2[0];
    const score = primary.cvssData?.baseScore;
    if (score != null) {
      return { severity: bandFromScoreV2(score), baseScore: score, cvssVersion: "2.0" };
    }
  }
  return null; // no usable metrics — rejected/reserved CVE, or NVD hasn't scored it yet
}

async function fetchNvd(cveId) {
  const headers = {};
  if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;
  const res = await fetch(`${NVD_API_URL}?cveId=${encodeURIComponent(cveId)}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    throw new Error(
      `NVD API ${res.status}${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`
    );
  }
  const body = await res.json();
  const cve = body.vulnerabilities?.[0]?.cve;
  if (!cve) return null;
  return extractCvss(cve);
}

async function collectCveIdsNeedingLookup(db) {
  const ids = new Set();
  for (const [id, entry] of Object.entries(db)) {
    const vuln = entry.data;
    if (hasOsvSeverity(vuln)) continue;
    if (CVE_RE.test(id)) ids.add(id);
    for (const alias of vuln.aliases ?? []) {
      if (CVE_RE.test(alias)) ids.add(alias);
    }
  }
  return [...ids].sort();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await loadEnvLocal();
  await mkdir(VULN_DIR, { recursive: true });

  const db = JSON.parse(await readFile(DB_PATH, "utf8").catch(() => "{}"));
  let nvdDb = {};
  if (!opts.force) {
    try {
      nvdDb = JSON.parse(await readFile(NVD_DB_PATH, "utf8"));
    } catch {
      nvdDb = {};
    }
  }

  const candidates = (await collectCveIdsNeedingLookup(db)).filter(
    (id) => opts.force || !(id in nvdDb)
  );
  const toFetch = candidates.slice(0, opts.limit);

  const delayMs = process.env.NVD_API_KEY ? AUTH_DELAY_MS : UNAUTH_DELAY_MS;
  console.log(
    `severity 없는 OSV 항목 중 CVE ${candidates.length}건 대상, 이번 실행에서 ${toFetch.length}건 조회 ` +
      `(${process.env.NVD_API_KEY ? "인증됨" : "미인증"}, 건당 약 ${delayMs}ms 대기 → 예상 ${
        Math.ceil((toFetch.length * delayMs) / 60000)
      }분)`
  );

  let filled = 0;
  let misses = 0;
  for (let i = 0; i < toFetch.length; i++) {
    const cveId = toFetch[i];
    try {
      const result = await fetchNvd(cveId);
      if (result) {
        nvdDb[cveId] = result;
        filled++;
      } else {
        // Tombstone: NVD has no CVSS data for this CVE (rejected/reserved/not
        // yet scored) — remember the miss so future runs don't re-query it
        // every time until --force is passed.
        nvdDb[cveId] = { severity: "UNKNOWN", baseScore: -1, cvssVersion: "none" };
        misses++;
      }
    } catch (err) {
      console.warn(`  ${cveId}: ${err.message} — 건너뜀 (다음 실행에서 재시도)`);
    }

    if ((i + 1) % 20 === 0 || i === toFetch.length - 1) {
      await writeFile(NVD_DB_PATH, JSON.stringify(nvdDb));
      console.log(`  진행 ${i + 1}/${toFetch.length} (채움 ${filled}, 데이터 없음 ${misses})`);
    }

    if (i < toFetch.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  await writeFile(NVD_DB_PATH, JSON.stringify(nvdDb));
  console.log(`완료: ${filled}건 채움, ${misses}건 NVD 데이터 없음. 출력 위치: ${NVD_DB_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
