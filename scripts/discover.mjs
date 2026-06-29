#!/usr/bin/env node
// Scans a few external sources for medical/medical-device open source projects
// not yet tracked in lib/projects.ts, and appends the new ones to
// lib/discovered.json (rendered by the dashboard as the "발견됨" category).
//
// Usage: npm run discover
// Set GITHUB_TOKEN in .env.local first — without it GitHub's API gives only
// 60 requests/hour (search: 10/min), which this script can burn through fast.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_TS = path.join(ROOT, "lib", "projects.ts");
const DISCOVERED_JSON = path.join(ROOT, "lib", "discovered.json");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const TOPICS = [
  "medical-device",
  "dicom",
  "digital-health",
  "clinical-decision-support",
  "biomedical",
  "telehealth",
  "medical-informatics",
  "ehr",
  "fhir",
  "healthcare",
];

const AWESOME_LISTS = [
  { label: "awesome-healthcare", owner: "kakoni", repo: "awesome-healthcare" },
  { label: "awesome-medphys", owner: "jrkerns", repo: "awesome-medphys" },
  { label: "awesome-dicom", owner: "open-dicom", repo: "awesome-dicom" },
];

// DPG Registry has no confirmed public JSON API reachable from this script
// (every guessed endpoint 404s), so that source was dropped rather than
// shipped broken. Revisit if DPGA publishes a documented API.

const MAX_NEW_PER_AWESOME_LIST = 15;
// GitHub topics pick up a lot of unrelated student/hobby repos that just
// happen to be tagged. Require a minimal star count to cut the obvious noise.
const MIN_TOPIC_STARS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadEnvLocal() {
  try {
    const text = await readFile(ENV_LOCAL, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env.local — fine, just means unauthenticated rate limits apply
  }
}

function ghHeaders() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

let coreRemaining = Infinity;
let searchRemaining = Infinity;

async function ghFetch(url, { isSearch = false } = {}) {
  if ((isSearch ? searchRemaining : coreRemaining) <= 1) {
    console.warn(`  ! rate limit 부족으로 건너뜀: ${url}`);
    return null;
  }
  const res = await fetch(url, { headers: ghHeaders() });
  const remHeader = res.headers.get("x-ratelimit-remaining");
  if (remHeader != null) {
    if (isSearch) searchRemaining = Number(remHeader);
    else coreRemaining = Number(remHeader);
  }
  if (!res.ok) {
    console.warn(`  ! GitHub API ${res.status}: ${url}`);
    return null;
  }
  return res.json();
}

async function existingOwnerRepoSet() {
  const [projectsText, discoveredText] = await Promise.all([
    readFile(PROJECTS_TS, "utf8"),
    readFile(DISCOVERED_JSON, "utf8").catch(() => "[]"),
  ]);

  const set = new Set();
  const slugs = new Set();
  const slugRe = /slug:\s*"([^"]+)"/g;
  let sm;
  while ((sm = slugRe.exec(projectsText))) {
    slugs.add(sm[1]); // includes category slugs too, which is fine — just extra safety margin
  }

  const re = /owner:\s*"([^"]+)"\s*,\s*\n\s*repo:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(projectsText))) {
    set.add(`${m[1]}/${m[2]}`.toLowerCase());
  }

  const discovered = JSON.parse(discoveredText || "[]");
  for (const p of discovered) {
    if (p.owner && p.repo) set.add(`${p.owner}/${p.repo}`.toLowerCase());
    if (p.slug) slugs.add(p.slug);
  }
  return { set, discovered, slugs };
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchTopicCandidates(topic) {
  await sleep(2000); // search API: 10/min unauthenticated, be conservative
  const json = await ghFetch(
    `https://api.github.com/search/repositories?q=topic:${encodeURIComponent(
      topic
    )}+archived:false&sort=stars&order=desc&per_page=15`,
    { isSearch: true }
  );
  if (!json?.items) return [];
  return json.items
    .filter((item) => item.stargazers_count >= MIN_TOPIC_STARS)
    .map((item) => ({
      owner: item.owner.login,
      repo: item.name,
      description: item.description || "",
      language: item.language,
      stars: item.stargazers_count,
      source: `github-topics:${topic}`,
    }));
}

async function fetchAwesomeListCandidates({ label, owner, repo }) {
  const meta = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!meta) return [];
  const branch = meta.default_branch || "main";

  let readme;
  try {
    for (const filename of ["README.md", "readme.md"]) {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`
      );
      if (res.ok) {
        readme = await res.text();
        break;
      }
    }
    if (!readme) {
      console.warn(`  ! README을 가져오지 못함: ${owner}/${repo}`);
      return [];
    }
  } catch {
    console.warn(`  ! README 요청 실패: ${owner}/${repo}`);
    return [];
  }

  const linkRe = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?![\w./-])/g;
  const seen = new Set();
  const links = [];
  let m;
  while ((m = linkRe.exec(readme))) {
    const o = m[1];
    const r = m[2].replace(/\.git$/, "");
    const key = `${o}/${r}`.toLowerCase();
    if (key === `${owner}/${repo}`.toLowerCase()) continue; // the list itself
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ owner: o, repo: r });
  }

  const candidates = [];
  for (const { owner: o, repo: r } of links.slice(0, MAX_NEW_PER_AWESOME_LIST)) {
    await sleep(300);
    const repoMeta = await ghFetch(`https://api.github.com/repos/${o}/${r}`);
    if (!repoMeta || repoMeta.archived) continue;
    candidates.push({
      owner: repoMeta.owner.login,
      repo: repoMeta.name,
      description: repoMeta.description || "",
      language: repoMeta.language,
      stars: repoMeta.stargazers_count,
      source: `awesome-list:${label}`,
    });
  }
  return candidates;
}

async function main() {
  await loadEnvLocal();
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "GITHUB_TOKEN이 없습니다 — GitHub API 한도(60/h, 검색 10/min)에 금방 걸릴 수 있어요.\n" +
        ".env.local에 GITHUB_TOKEN을 설정하면 더 많은 후보를 수집할 수 있습니다.\n"
    );
  }

  const {
    set: existing,
    discovered: previouslyDiscovered,
    slugs: existingSlugs,
  } = await existingOwnerRepoSet();

  console.log("1) GitHub Topics 검색 중...");
  const topicResults = [];
  for (const topic of TOPICS) {
    const found = await fetchTopicCandidates(topic);
    console.log(`   topic:${topic} -> ${found.length}건`);
    topicResults.push(...found);
  }

  console.log("2) awesome 리스트 재스캔 중...");
  const awesomeResults = [];
  for (const list of AWESOME_LISTS) {
    const found = await fetchAwesomeListCandidates(list);
    console.log(`   ${list.label} -> ${found.length}건`);
    awesomeResults.push(...found);
  }

  const all = [...topicResults, ...awesomeResults];

  const byKey = new Map();
  for (const c of all) {
    const key = `${c.owner}/${c.repo}`.toLowerCase();
    if (existing.has(key)) continue; // already tracked somewhere
    if (!byKey.has(key)) byKey.set(key, c);
  }

  const newCandidates = [...byKey.values()];
  const today = new Date().toISOString().slice(0, 10);

  const newEntries = newCandidates.map((c) => {
    let slug = slugify(c.repo);
    let suffix = 2;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(c.repo)}-${suffix++}`;
    }
    existingSlugs.add(slug);
    return {
      slug,
      name: c.repo,
      owner: c.owner,
      repo: c.repo,
      description:
        c.description?.trim() ||
        "(설명 없음 — 자동 수집, 직접 확인 필요)",
      tags: [c.language || "Unknown", "Auto-discovered"],
      discoveredAt: today,
      source: c.source,
    };
  });

  const merged = [...previouslyDiscovered, ...newEntries];
  await writeFile(DISCOVERED_JSON, JSON.stringify(merged, null, 2) + "\n");

  console.log(
    `\n완료: 신규 후보 ${newEntries.length}건을 lib/discovered.json에 추가했습니다 ` +
      `(누적 ${merged.length}건). 대시보드의 "발견됨" 섹션에서 확인하세요.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
