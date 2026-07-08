#!/usr/bin/env node
// VEX (Vulnerability Exploitability eXchange) pilot: automates ONE not_affected
// ground — "vulnerable_code_not_present" — for a top-N slice of projects.
//
// For each eligible (component, vuln) pair (npm/pypi ecosystem, fix commit
// info available in OSV data): fetch the fix commit's diff, extract candidate
// function names from the changed hunks, download the actually-installed
// package version's full source from the registry, and check whether any of
// those function names appear anywhere in the readable (non-minified) source.
// Zero occurrences -> not_affected. Anything else (function found, ambiguous,
// fetch failure, minified-only source, wheel-only release, merge commit, ...)
// -> under_investigation. Never guess in the risky direction — see the plan
// this script was built against for the reasoning (medical supply-chain data;
// a false not_affected is worse than staying "unverified").
//
// This intentionally does NOT attempt the "component_not_present" ground —
// OSV matches are purl-driven, so a matched component is by construction
// already present in the SBOM; that ground is structurally inapplicable here.
// It also does NOT attempt "affected" determination (execution-path/taint
// analysis) — everything not proven not_affected stays under_investigation.
//
// Usage: npm run vex                      (top 20 slugs by vuln count)
//        npm run vex -- --top 40
//        npm run vex -- --slug repmode --slug dltk   (explicit, skips ranking)
//        npm run vex -- --force            (ignore per-entry cache, redo all)
//        npm run vex -- --dry-run          (report candidate count, no fetches)

import { readFile, writeFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as tar from "tar";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VULN_DIR = path.join(ROOT, "vulns");
const DB_PATH = path.join(VULN_DIR, "_db.json");
const VEX_DIR = path.join(ROOT, "vex");
const COMMIT_CACHE_PATH = path.join(VEX_DIR, "_commit_cache.json");
const WORK_DIR = path.join(ROOT, "vex-work");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const DEFAULT_TOP = 20;
// GHSA (npm's advisory source) almost always tags its GitHub fix-commit link
// as "WEB" rather than "FIX" — without this, npm ends up with ~0 automatable
// candidates even though it's 79% of tracked components. The safety gate
// (full-source zero-occurrence check) applies identically regardless of
// which reference type pointed us at the commit, so this only affects
// eligibility, not correctness.
const COMMIT_URL_REF_TYPES = new Set(["FIX", "WEB"]);

const NON_SOURCE_EXT = /\.(md|rst|txt|ya?ml|json|toml|cfg|ini|lock|csv|png|jpg|jpeg|gif|svg|pdf)$/i;
const BINARY_EXT = /\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|zip|gz|tgz|whl|so|dylib|dll|node|pyc|class|jar|wasm|map|pdf)$/i;
const MAX_FILE_BYTES = 2_000_000;
const MAX_COMMIT_FILES = 300; // GitHub's commits API elides files beyond this — treat as truncated

const RESERVED_WORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "get", "set", "function",
  "class", "public", "private", "static", "void", "const", "let", "var", "new",
  "else", "case", "default", "try", "finally", "throw", "async", "await",
]);
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@\s?(.*)$/;
const FN_PATTERNS = [
  /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/, // Python
  /\bc(?:p)?def\s+(?:\w[\w[\]*]*\s+)*([A-Za-z_][A-Za-z0-9_]*)\s*\(/, // Cython cdef/cpdef (common in C-extension-backed PyPI packages, e.g. lxml)
  /\bfunction\s*\*?\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/, // JS function decl
  /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]\s*(?:async\s*)?function\s*\(/, // JS assigned fn
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}()]*\)\s*\{?\s*$/, // C/C++/Java-ish "name(...) {"
];

async function loadEnvLocal() {
  try {
    const text = await readFile(ENV_LOCAL, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env.local — unauthenticated GitHub rate limits apply
  }
}

function ghHeaders() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function rateLimitReason(res) {
  const retryAfter = res.headers.get("retry-after");
  return retryAfter
    ? `GitHub API 요청 급증으로 제한됨 — ${retryAfter}초 후 재시도`
    : "GitHub API 호출 한도 초과 — GITHUB_TOKEN 설정 권장";
}

function parseArgs(argv) {
  const opts = { top: DEFAULT_TOP, slugs: [], force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--top") opts.top = Number(argv[++i]) || DEFAULT_TOP;
    else if (argv[i] === "--slug") opts.slugs.push(argv[++i]);
    else if (argv[i] === "--force") opts.force = true;
    else if (argv[i] === "--dry-run") opts.dryRun = true;
    else opts.slugs.push(argv[i]);
  }
  return opts;
}

async function safeRm(dir) {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 });
  } catch (err) {
    console.warn(`  임시 폴더 삭제 실패(무시): ${err.message}`);
  }
}

// ---------- ranking & data loading ----------

async function rankSlugsByVulnCount(index) {
  let files;
  try {
    files = await readdir(VULN_DIR);
  } catch {
    return [];
  }
  const reportFiles = files.filter((f) => f.endsWith(".json") && f !== "_db.json");
  const ranked = [];
  for (const f of reportFiles) {
    let report;
    try {
      report = JSON.parse(await readFile(path.join(VULN_DIR, f), "utf8"));
    } catch {
      continue;
    }
    const uniqueIds = new Set(
      report.affected.flatMap((c) => c.vulnIds.map((id) => index.canonicalId(id)))
    );
    ranked.push({ slug: report.slug, count: uniqueIds.size });
  }
  return ranked.sort((a, b) => b.count - a.count);
}

async function readVulnsReport(slug) {
  try {
    return JSON.parse(await readFile(path.join(VULN_DIR, `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function loadVulnDb() {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** Union-find over OSV alias groups (CVE/GHSA/PYSEC/... describing the same
 *  underlying vulnerability) — mirrors lib/osv.ts's buildVulnIndex, ported to
 *  plain JS since scripts/*.mjs can't import .ts. Correctness-critical here:
 *  a component can carry several *distinct* vulnerabilities in its vulnIds
 *  list (not just aliases of one), and each needs its own VEX determination —
 *  without this grouping, iterating raw ids risks silently skipping some. */
function buildVulnIndex(db) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const id of Object.keys(db)) find(id);
  for (const [id, entry] of Object.entries(db)) {
    for (const alias of entry.data?.aliases ?? []) union(id, alias);
  }

  const membersByRoot = new Map();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root).push(id);
  }

  return {
    canonicalId: (id) => find(id),
    membersOf: (canonicalId) => membersByRoot.get(canonicalId) ?? [canonicalId],
  };
}

async function readExistingVex(slug) {
  try {
    return JSON.parse(await readFile(path.join(VEX_DIR, `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function loadCommitCache() {
  try {
    return JSON.parse(await readFile(COMMIT_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveCommitCache(cache) {
  await writeFile(COMMIT_CACHE_PATH, JSON.stringify(cache));
}

// ---------- fix-commit extraction ----------

function parseGithubRepoUrl(url) {
  if (typeof url !== "string") return null;
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

function parseGithubCommitUrl(url) {
  if (typeof url !== "string") return null;
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/i.exec(url.trim());
  return m ? { owner: m[1], repo: m[2], sha: m[3] } : null;
}

/** Returns deduped [{owner, repo, sha, source, url}] from an OSV vuln's raw
 *  `affected[].ranges[]` (GIT type) and `references[]` (FIX / WEB commit URLs). */
function extractFixCommits(osvData) {
  const commits = [];
  for (const a of osvData?.affected ?? []) {
    for (const r of a.ranges ?? []) {
      if (r.type !== "GIT" || !r.repo) continue;
      const parsed = parseGithubRepoUrl(r.repo);
      if (!parsed) continue;
      for (const ev of r.events ?? []) {
        if (ev.fixed && /^[0-9a-f]{7,40}$/i.test(ev.fixed)) {
          commits.push({
            ...parsed,
            sha: ev.fixed,
            source: "GIT_RANGE",
            url: `https://github.com/${parsed.owner}/${parsed.repo}/commit/${ev.fixed}`,
          });
        }
      }
    }
  }
  for (const ref of osvData?.references ?? []) {
    if (!COMMIT_URL_REF_TYPES.has(ref.type)) continue;
    const parsed = parseGithubCommitUrl(ref.url);
    if (parsed) commits.push({ ...parsed, source: ref.type === "FIX" ? "FIX_REF" : "WEB_COMMIT_URL", url: ref.url });
  }
  const seen = new Set();
  return commits.filter((c) => {
    const key = `${c.owner}/${c.repo}@${c.sha}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchCommit(owner, repo, sha, headers, cache) {
  const key = `${owner}/${repo}@${sha}`;
  if (cache[key]) return cache[key];

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers });
  if (res.status === 404) return { ok: false, reason: "커밋을 찾을 수 없음 (404)" };
  if (res.status === 429 || res.status === 403) return { ok: false, reason: rateLimitReason(res) };
  if (!res.ok) return { ok: false, reason: `GitHub API 오류 (${res.status})` };

  const data = await res.json();
  if ((data.parents ?? []).length > 1) {
    return { ok: false, reason: "merge 커밋 — 단일 parent 대비 diff가 모호함" };
  }
  const allFiles = data.files ?? [];
  if (allFiles.length >= MAX_COMMIT_FILES) {
    return { ok: false, reason: "변경 파일이 너무 많아 diff가 잘렸을 수 있음" };
  }
  const files = allFiles.filter((f) => typeof f.patch === "string").map((f) => ({ filename: f.filename, patch: f.patch }));
  const result = { ok: true, files, totalFiles: allFiles.length };
  cache[key] = result; // only cache successes — commits are immutable once merged; failures retried next run
  return result;
}

function extractFunctionNamesFromPatch(patch) {
  const names = new Set();
  for (const line of patch.split("\n")) {
    const m = HUNK_HEADER_RE.exec(line);
    if (!m || !m[1]) continue;
    const context = m[1].trim();
    for (const re of FN_PATTERNS) {
      const fm = re.exec(context);
      if (fm && fm[1] && fm[1].length >= 3 && !RESERVED_WORDS.has(fm[1])) names.add(fm[1]);
    }
  }
  return [...names];
}

function extractFunctionNamesFromCommit(files) {
  const sourceFiles = files.filter((f) => !NON_SOURCE_EXT.test(f.filename));
  if (sourceFiles.length === 0) return { names: [], reason: "문서/설정 파일만 변경됨" };
  const names = new Set();
  for (const f of sourceFiles) {
    for (const n of extractFunctionNamesFromPatch(f.patch)) names.add(n);
  }
  if (names.size === 0) return { names: [], reason: "diff에서 함수명을 추출하지 못함" };
  return { names: [...names], reason: null };
}

// ---------- package source fetch ----------

function npmTarballUrl(name, version) {
  const short = name.includes("/") ? name.split("/")[1] : name;
  const encodedName = name.startsWith("@") ? name.replace("/", "%2f") : name;
  return `https://registry.npmjs.org/${encodedName}/-/${short}-${version}.tgz`;
}

async function pypiSdistUrl(name, version) {
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`);
  if (!res.ok) return null;
  const data = await res.json();
  const sdist = (data.urls ?? []).find((u) => u.packagetype === "sdist" && /\.(tar\.gz|tgz)$/i.test(u.filename));
  return sdist?.url ?? null;
}

async function fetchAndExtractTarball(url, destDir) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, reason: `네트워크 오류: ${err.message}` };
  }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

  await mkdir(destDir, { recursive: true });
  const tmpFile = path.join(destDir, "__download.tgz");
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(tmpFile, buf);
    await tar.extract({ file: tmpFile, cwd: destDir, gzip: true });
  } catch (err) {
    return { ok: false, reason: `tar 압축 해제 실패: ${err.message}` };
  } finally {
    await rm(tmpFile, { force: true }).catch(() => {});
  }
  return { ok: true };
}

/** Returns { files, unsearchedCount }. `unsearchedCount` tracks files that
 *  passed the binary-extension filter (so they're plausibly source/text, not
 *  images/fonts/compiled artifacts) but couldn't actually be searched — too
 *  large to read in full, or not valid UTF-8. These must NOT be silently
 *  dropped: a real vulnerable function could be sitting in exactly one of
 *  them (e.g. an oversized bundled dist file outside the dist/build path
 *  heuristic), so searchForFunctionNames treats this the same as a minified
 *  file it couldn't check — a coverage gap that blocks a not_affected verdict. */
async function walkFiles(dir) {
  const out = [];
  let unsearchedCount = 0;
  async function recurse(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        await recurse(full);
        continue;
      }
      if (BINARY_EXT.test(e.name)) continue;
      let s;
      try {
        s = await stat(full);
      } catch {
        unsearchedCount++;
        continue;
      }
      if (s.size > MAX_FILE_BYTES) {
        unsearchedCount++;
        continue;
      }
      let content;
      try {
        content = await readFile(full, "utf8");
      } catch {
        unsearchedCount++; // not valid utf8 text — could still be relevant source, don't just drop it
        continue;
      }
      out.push({ path: full, content });
    }
  }
  await recurse(dir);
  return { files: out, unsearchedCount };
}

function isMinifiedOrBundled(filePath, content) {
  if (/\.min\.[jt]s$/i.test(filePath)) return true;
  if (/[\\/](dist|build)[\\/]/i.test(filePath)) {
    const lines = content.split("\n").filter((l) => l.length > 0);
    const avgLineLen = content.length / Math.max(lines.length, 1);
    if (avgLineLen > 300) return true;
    if (content.length > 500_000 && lines.length < 50) return true;
  }
  return false;
}

/** Conservative core: not_affected requires zero occurrences of every checked
 *  name across every *readable* file, AND zero unsearched files (minified,
 *  oversized, non-UTF8). Any coverage gap, or any occurrence at all, falls
 *  back to inconclusive/present — never guessed. */
function searchForFunctionNames(files, names, unsearchedCount) {
  const tagged = files.map((f) => ({ ...f, minified: isMinifiedOrBundled(f.path, f.content) }));
  const readable = tagged.filter((f) => !f.minified);
  const minifiedCount = tagged.length - readable.length;
  const gapCount = minifiedCount + unsearchedCount;

  if (readable.length === 0) {
    return { verdict: "inconclusive", reason: "minified/bundled 파일만 존재 — 검색 불가", filesSearched: 0, filesSkippedMinified: gapCount };
  }
  const found = names.filter((n) => readable.some((f) => f.content.includes(n)));
  if (found.length > 0) {
    return { verdict: "present", filesSearched: readable.length, filesSkippedMinified: gapCount };
  }
  if (gapCount > 0) {
    return {
      verdict: "inconclusive",
      reason: "읽을 수 있는 파일에서는 못 찾았으나 검사하지 못한 파일(minified/용량초과/비-UTF8)이 있어 부분 검사만 가능",
      filesSearched: readable.length,
      filesSkippedMinified: gapCount,
    };
  }
  return { verdict: "absent", filesSearched: readable.length, filesSkippedMinified: 0 };
}

const packageSourceCache = new Map();

async function getPackageSource(ecosystem, name, version, workDir) {
  const key = `${ecosystem}:${name}@${version}`;
  if (packageSourceCache.has(key)) return packageSourceCache.get(key);

  const promise = (async () => {
    let url;
    if (ecosystem === "npm") {
      url = npmTarballUrl(name, version);
    } else {
      url = await pypiSdistUrl(name, version);
      if (!url) return { error: "sdist 없음 (wheel 전용 릴리스)" };
    }
    const destDir = path.join(workDir, key.replace(/[^a-zA-Z0-9_.-]/g, "_"));
    const extract = await fetchAndExtractTarball(url, destDir);
    if (!extract.ok) return { error: extract.reason };
    const { files, unsearchedCount } = await walkFiles(destDir);
    return { files, unsearchedCount, sourceUrl: url };
  })();

  packageSourceCache.set(key, promise);
  return promise;
}

// ---------- per-(component,vuln) determination ----------

function makeEntry(component, vulnId, status, justification, osvModified, evidence) {
  return {
    componentName: component.name,
    componentVersion: component.version,
    purl: component.purl,
    vulnId,
    status,
    justification,
    attempted: true,
    checkedAt: new Date().toISOString(),
    osvModifiedAtCheck: osvModified ?? null,
    evidence,
  };
}

async function determineEntry({ component, vulnIds, db, headers, commitCache, workDir }) {
  const ecosystem = component.purl?.startsWith("pkg:npm/")
    ? "npm"
    : component.purl?.startsWith("pkg:pypi/")
      ? "pypi"
      : null;
  if (!ecosystem || !component.version) return null;

  for (const vulnId of vulnIds) {
    const osvEntry = db[vulnId];
    if (!osvEntry) continue;
    const commits = extractFixCommits(osvEntry.data);
    if (commits.length === 0) continue; // not eligible via this alias — try next

    const evidence = {
      fixCommits: commits,
      functionNamesChecked: [],
      filesSearched: 0,
      filesSkippedMinified: 0,
      packageSourceUrl: null,
      reason: null,
    };

    let anyCommitOk = false;
    const allNames = new Set();
    for (const c of commits) {
      const commitResult = await fetchCommit(c.owner, c.repo, c.sha, headers, commitCache);
      if (!commitResult.ok) {
        evidence.reason = evidence.reason ?? commitResult.reason;
        continue;
      }
      anyCommitOk = true;
      const { names, reason } = extractFunctionNamesFromCommit(commitResult.files);
      if (reason) evidence.reason = evidence.reason ?? reason;
      for (const n of names) allNames.add(n);
    }

    if (!anyCommitOk) {
      return makeEntry(component, vulnId, "under_investigation", null, osvEntry.modified, evidence);
    }
    if (allNames.size === 0) {
      evidence.reason = evidence.reason ?? "함수명 추출 실패";
      return makeEntry(component, vulnId, "under_investigation", null, osvEntry.modified, evidence);
    }
    evidence.functionNamesChecked = [...allNames];

    const source = await getPackageSource(ecosystem, component.name, component.version, workDir);
    if (source.error) {
      evidence.reason = source.error;
      return makeEntry(component, vulnId, "under_investigation", null, osvEntry.modified, evidence);
    }
    evidence.packageSourceUrl = source.sourceUrl;

    const search = searchForFunctionNames(source.files, evidence.functionNamesChecked, source.unsearchedCount);
    evidence.filesSearched = search.filesSearched;
    evidence.filesSkippedMinified = search.filesSkippedMinified;

    if (search.verdict === "absent") {
      return makeEntry(component, vulnId, "not_affected", "vulnerable_code_not_present", osvEntry.modified, evidence);
    }
    evidence.reason = search.reason ?? evidence.reason;
    return makeEntry(component, vulnId, "under_investigation", null, osvEntry.modified, evidence);
  }
  return null; // no vulnId on this component had usable fix-commit data — never attempted
}

// ---------- per-slug orchestration ----------

async function processSlug(slug, { db, index, headers, commitCache, workDir, force }) {
  const report = await readVulnsReport(slug);
  if (!report) return null;

  const existing = await readExistingVex(slug);
  const existingByComponent = new Map();
  for (const e of existing?.entries ?? []) {
    const k = `${e.componentName}::${e.componentVersion}`;
    if (!existingByComponent.has(k)) existingByComponent.set(k, []);
    existingByComponent.get(k).push(e);
  }

  const outEntries = [];
  const stats = { notAffected: 0, underInvestigation: 0, neverAttempted: 0, skippedCached: 0 };

  for (const component of report.affected) {
    // Ecosystem/version eligibility is (re-)checked inside determineEntry per
    // group below — it returns null for ineligible components, which the
    // group loop already counts as neverAttempted.
    //
    // A component's vulnIds list can contain several *distinct* vulnerabilities
    // (not just aliases of one) — group by canonical id so each gets its own
    // determination instead of one arbitrary winner deciding for the component.
    // stats.neverAttempted counts canonical groups throughout (not raw ids),
    // for consistency with the notAffected/underInvestigation counters below.
    const groups = new Map(); // canonicalId -> member ids present on this component
    for (const id of component.vulnIds) {
      const canonicalId = index.canonicalId(id);
      if (!groups.has(canonicalId)) groups.set(canonicalId, []);
      groups.get(canonicalId).push(id);
    }

    const key = `${component.name}::${component.version}`;
    const prevEntries = existingByComponent.get(key) ?? [];

    for (const [canonicalId, memberIds] of groups) {
      let reused = null;
      if (!force) {
        for (const prev of prevEntries) {
          if (index.canonicalId(prev.vulnId) !== canonicalId) continue;
          const currentModified = db[prev.vulnId]?.modified ?? null;
          if (currentModified && currentModified === prev.osvModifiedAtCheck) {
            reused = prev;
            break;
          }
        }
      }

      if (reused) {
        outEntries.push(reused);
        stats.skippedCached++;
        if (reused.status === "not_affected") stats.notAffected++;
        else stats.underInvestigation++;
        continue;
      }

      const result = await determineEntry({ component, vulnIds: memberIds, db, headers, commitCache, workDir });
      if (!result) {
        stats.neverAttempted++;
        continue;
      }
      outEntries.push(result);
      if (result.status === "not_affected") stats.notAffected++;
      else stats.underInvestigation++;
    }
  }

  await writeFile(
    path.join(VEX_DIR, `${slug}.json`),
    JSON.stringify({ slug, scannedAt: new Date().toISOString(), entries: outEntries })
  );
  return stats;
}

// ---------- main ----------

async function main() {
  await loadEnvLocal();
  const headers = ghHeaders();
  const opts = parseArgs(process.argv.slice(2));

  await mkdir(VEX_DIR, { recursive: true });
  await mkdir(WORK_DIR, { recursive: true });

  const db = await loadVulnDb();
  const index = buildVulnIndex(db);

  let slugs;
  if (opts.slugs.length) {
    slugs = opts.slugs;
  } else {
    const ranked = await rankSlugsByVulnCount(index);
    slugs = ranked.slice(0, opts.top).map((r) => r.slug);
  }

  if (slugs.length === 0) {
    console.error("대상 슬러그가 없습니다 (vulns/ 에 스캔 결과가 있는지 확인하세요).");
    process.exitCode = 1;
    return;
  }

  console.log(`대상 ${slugs.length}건: ${slugs.join(", ")}\n`);

  if (opts.dryRun) {
    let candidates = 0;
    for (const slug of slugs) {
      const report = await readVulnsReport(slug);
      if (!report) continue;
      for (const c of report.affected) {
        const ecosystem = c.purl?.startsWith("pkg:npm/") ? "npm" : c.purl?.startsWith("pkg:pypi/") ? "pypi" : null;
        if (!ecosystem) continue;
        const seenGroups = new Set();
        for (const id of c.vulnIds) {
          const canonicalId = index.canonicalId(id);
          if (seenGroups.has(canonicalId)) continue;
          if (db[id] && extractFixCommits(db[id].data).length > 0) {
            candidates++;
            seenGroups.add(canonicalId);
          }
        }
      }
    }
    console.log(`--dry-run: fix 커밋 정보가 있는 npm/PyPI (컴포넌트,취약점) 후보 약 ${candidates}건 (실제 조회는 하지 않음)`);
    return;
  }

  const commitCache = await loadCommitCache();
  const totals = { notAffected: 0, underInvestigation: 0, neverAttempted: 0, skippedCached: 0 };

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    console.log(`[${i + 1}/${slugs.length}] ${slug} 처리 중...`);
    const stats = await processSlug(slug, { db, index, headers, commitCache, workDir: WORK_DIR, force: opts.force });
    if (!stats) {
      console.warn(`  ${slug} — vulns/${slug}.json 없음, 건너뜀`);
      continue;
    }
    for (const k of Object.keys(totals)) totals[k] += stats[k];
    console.log(
      `  완료 — not_affected ${stats.notAffected}, under_investigation ${stats.underInvestigation}, 미시도 ${stats.neverAttempted}, 캐시재사용 ${stats.skippedCached}`
    );
    await saveCommitCache(commitCache); // persist incrementally in case a later slug hits a rate limit
  }

  await safeRm(WORK_DIR);

  console.log(
    `\n전체 완료: not_affected ${totals.notAffected}건, under_investigation ${totals.underInvestigation}건, 미시도 ${totals.neverAttempted}건, 캐시재사용 ${totals.skippedCached}건`
  );
  console.log(`출력 위치: ${VEX_DIR}`);
}

main().catch(async (err) => {
  console.error(err);
  await safeRm(WORK_DIR);
  process.exitCode = 1;
});
