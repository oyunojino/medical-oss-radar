#!/usr/bin/env node
// Queries OSV.dev for known vulnerabilities in every CycloneDX SBOM under sboms/.
//
// For each project: collect purls from sboms/<slug>.cdx.json -> dedupe across all
// projects -> OSV querybatch (id + modified only) -> fetch full details only for
// ids that are new or whose `modified` timestamp changed since last run (cached
// in vulns/_db.json) -> write vulns/<slug>.json (per-project affected components).
//
// Usage: npm run osv             (all projects with an SBOM)
//        npm run osv -- openmrs pydicom   (only these slugs)

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SBOM_DIR = path.join(ROOT, "sboms");
const OUT_DIR = path.join(ROOT, "vulns");
const DB_PATH = path.join(OUT_DIR, "_db.json");

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const osvVulnUrl = (id) => `https://api.osv.dev/v1/vulns/${id}`;
const BATCH_SIZE = 1000; // OSV querybatch hard limit per request
const DETAIL_CONCURRENCY = 8;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listSlugs() {
  const files = await readdir(SBOM_DIR);
  const slugs = new Set();
  for (const f of files) {
    const m = f.match(/^(.+)\.cdx\.json$/);
    if (m) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

async function loadCdx(slug) {
  const text = await readFile(path.join(SBOM_DIR, `${slug}.cdx.json`), "utf8");
  return JSON.parse(text);
}

async function loadDb() {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function queryBatch(purls) {
  const results = [];
  for (let i = 0; i < purls.length; i += BATCH_SIZE) {
    const chunk = purls.slice(i, i + BATCH_SIZE);
    const res = await fetch(OSV_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: chunk.map((purl) => ({ package: { purl } })) }),
    });
    if (!res.ok) {
      throw new Error(`OSV querybatch 실패: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    }
    const body = await res.json();
    results.push(...(body.results ?? []));
    if (i + BATCH_SIZE < purls.length) await sleep(300);
  }
  return results;
}

async function fetchVulnDetail(id) {
  const res = await fetch(osvVulnUrl(id));
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  return res.json();
}

async function mapWithConcurrency(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const allSlugs = await listSlugs();
  const only = process.argv.slice(2);
  const slugs = only.length ? allSlugs.filter((s) => only.includes(s)) : allSlugs;
  if (slugs.length === 0) {
    console.error("대상 SBOM이 없습니다.");
    process.exitCode = 1;
    return;
  }
  console.log(`대상 ${slugs.length}건 (SBOM ${allSlugs.length}건 중)\n`);

  // 1. Load each slug's components (only ones with a purl can be queried), dedupe purls.
  const perSlugComponents = new Map();
  const purlSet = new Set();

  for (const slug of slugs) {
    let cdx;
    try {
      cdx = await loadCdx(slug);
    } catch (err) {
      console.warn(`${slug} — SBOM을 읽을 수 없음: ${err.message}`);
      continue;
    }
    const comps = (cdx.components ?? [])
      .filter((c) => c.purl)
      .map((c) => ({ name: c.name, version: c.version, purl: c.purl }));
    perSlugComponents.set(slug, comps);
    for (const c of comps) purlSet.add(c.purl);
  }

  const purls = [...purlSet];
  console.log(`고유 purl ${purls.length}건 조회 중 (OSV querybatch)...`);

  const batchResults = await queryBatch(purls);
  const purlToVulnRefs = new Map();
  purls.forEach((purl, i) => {
    purlToVulnRefs.set(purl, batchResults[i]?.vulns ?? []);
  });

  // 2. Unique vuln ids (+ their `modified` timestamp) across all purls.
  const idToModified = new Map();
  for (const refs of purlToVulnRefs.values()) {
    for (const v of refs) idToModified.set(v.id, v.modified);
  }
  console.log(`발견된 고유 취약점 ID ${idToModified.size}건`);

  // 3. Fetch full details only for ids that are new or changed since the cached run.
  const db = await loadDb();
  const idsNeedingFetch = [...idToModified.entries()]
    .filter(([id, modified]) => db[id]?.modified !== modified)
    .map(([id]) => id);

  console.log(
    `상세 정보 조회: 캐시 적중 ${idToModified.size - idsNeedingFetch.length}건, 신규/변경 ${idsNeedingFetch.length}건`
  );

  let fetched = 0;
  await mapWithConcurrency(idsNeedingFetch, DETAIL_CONCURRENCY, async (id) => {
    try {
      const data = await fetchVulnDetail(id);
      db[id] = { modified: idToModified.get(id), data };
      fetched++;
      if (fetched % 25 === 0) console.log(`  ... ${fetched}/${idsNeedingFetch.length}`);
    } catch (err) {
      console.warn(`  ${id} 상세 조회 실패: ${err.message}`);
    }
  });

  await writeFile(DB_PATH, JSON.stringify(db));
  console.log(`취약점 DB 저장: ${DB_PATH} (총 ${Object.keys(db).length}건)`);

  // 4. Per-slug affected-component report.
  const scannedAt = new Date().toISOString();
  let slugsWithVulns = 0;
  for (const slug of slugs) {
    const comps = perSlugComponents.get(slug) ?? [];
    const affected = comps
      .map((c) => ({
        name: c.name,
        version: c.version,
        purl: c.purl,
        vulnIds: (purlToVulnRefs.get(c.purl) ?? []).map((v) => v.id),
      }))
      .filter((c) => c.vulnIds.length > 0);

    if (affected.length > 0) slugsWithVulns++;

    await writeFile(
      path.join(OUT_DIR, `${slug}.json`),
      JSON.stringify({ slug, scannedAt, componentCount: comps.length, affected })
    );
  }

  console.log(`\n완료: ${slugs.length}건 스캔, ${slugsWithVulns}건에서 취약점 발견.`);
  console.log(`출력 위치: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
