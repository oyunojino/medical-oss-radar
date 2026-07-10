#!/usr/bin/env node
// Downloads CISA's Known Exploited Vulnerabilities (KEV) catalog — CVEs the US
// government has confirmed are being actively exploited in the wild, as opposed
// to OSV's severity field which only rates how bad a vuln *could* be.
//
// Public JSON feed, no auth, no rate limit. Written as a CVE-id-keyed map so
// lib/osv.ts can do an O(1) lookup per alias when building vuln groups.
//
// Usage: npm run kev

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "vulns");
const OUT_PATH = path.join(OUT_DIR, "_kev.json");

const KEV_FEED_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("CISA KEV 피드 조회 중...");
  const res = await fetch(KEV_FEED_URL);
  if (!res.ok) {
    throw new Error(`KEV 피드 조회 실패: ${res.status}`);
  }
  const body = await res.json();
  const entries = body.vulnerabilities ?? [];

  const db = {};
  for (const v of entries) {
    db[v.cveID] = {
      dateAdded: v.dateAdded,
      dueDate: v.dueDate,
      vulnerabilityName: v.vulnerabilityName,
      knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
      shortDescription: v.shortDescription,
    };
  }

  await writeFile(OUT_PATH, JSON.stringify(db));
  console.log(`완료: ${Object.keys(db).length}건 저장 (카탈로그 버전 ${body.catalogVersion}).`);
  console.log(`출력 위치: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
