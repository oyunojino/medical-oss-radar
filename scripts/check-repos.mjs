#!/usr/bin/env node
// Validates owner/repo slugs in lib/discovered.json against the live GitHub API.
//
// - Renamed/transferred repos: GitHub's API redirects these requests to the
//   new owner/name, so the response's own full_name confirms the identity —
//   safe to auto-fix, no guessing involved.
// - True 404s (deleted, or moved without a surviving redirect): only
//   reported, never auto-fixed. Picking a replacement repo requires
//   confirming it's actually the same project (see the OpenSpecimen/OpenLMIS/
//   LabKey fixes in lib/projects.ts, which needed manual verification) —
//   an automated guess risks silently wiring in the wrong project.
//
// Usage: npm run check-repos          (report only)
//        npm run check-repos -- --fix (also rewrite auto-fixable renames)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DISCOVERED_JSON = path.join(ROOT, "lib", "discovered.json");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const APPLY_FIX = process.argv.includes("--fix");
const CONCURRENCY = 8;

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
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function checkOne({ slug, owner, repo }) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: ghHeaders(),
    });
    if (res.status === 404) return { slug, owner, repo, status: "not-found" };
    if (!res.ok) return { slug, owner, repo, status: "error", detail: `HTTP ${res.status}` };

    const data = await res.json();
    const [canonOwner, canonRepo] = data.full_name.split("/");
    const sameIdentity =
      canonOwner.toLowerCase() === owner.toLowerCase() && canonRepo.toLowerCase() === repo.toLowerCase();

    if (!sameIdentity) {
      return { slug, owner, repo, status: "renamed", canonOwner, canonRepo, archived: data.archived };
    }
    return { slug, owner, repo, status: "ok", archived: data.archived };
  } catch (err) {
    return { slug, owner, repo, status: "network-error", detail: err.message };
  }
}

async function main() {
  await loadEnvLocal();
  if (!process.env.GITHUB_TOKEN) {
    console.warn("GITHUB_TOKEN이 없습니다 — 60건/시간 한도에 금방 걸릴 수 있습니다.\n");
  }

  const discovered = JSON.parse(await readFile(DISCOVERED_JSON, "utf8"));
  const targets = discovered.filter((p) => p.owner && p.repo);

  const results = [];
  let index = 0;
  async function worker() {
    while (index < targets.length) {
      results.push(await checkOne(targets[index++]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  const renamed = results.filter((r) => r.status === "renamed");
  const notFound = results.filter((r) => r.status === "not-found");
  const errored = results.filter((r) => r.status === "error" || r.status === "network-error");
  const okCount = results.length - renamed.length - notFound.length - errored.length;

  console.log(`검사 완료: 총 ${results.length}건 중 정상 ${okCount}건`);

  if (renamed.length) {
    console.log(`\n이름/소유자 변경 — 자동 수정 대상 ${renamed.length}건:`);
    for (const r of renamed) {
      console.log(`  ${r.slug}: ${r.owner}/${r.repo} -> ${r.canonOwner}/${r.canonRepo}`);
    }
  }

  if (notFound.length) {
    console.log(
      `\n404 — 수동 확인 필요 ${notFound.length}건 (자동으로 고치지 않음, 잘못된 저장소를 연결할 위험):`
    );
    for (const r of notFound) console.log(`  ${r.slug}: ${r.owner}/${r.repo}`);
  }

  if (errored.length) {
    console.log(`\n기타 오류 ${errored.length}건:`);
    for (const r of errored) console.log(`  ${r.slug}: ${r.owner}/${r.repo} (${r.detail})`);
  }

  if (renamed.length === 0) {
    console.log("\n자동 수정할 항목이 없습니다.");
    return;
  }

  if (!APPLY_FIX) {
    console.log(
      `\n${renamed.length}건을 discovered.json에 반영하려면 --fix 옵션을 붙여 다시 실행하세요:\n  npm run check-repos -- --fix`
    );
    return;
  }

  const bySlug = new Map(renamed.map((r) => [r.slug, r]));
  const updated = discovered.map((p) => {
    const fix = bySlug.get(p.slug);
    if (!fix) return p;
    return { ...p, owner: fix.canonOwner, repo: fix.canonRepo };
  });
  await writeFile(DISCOVERED_JSON, JSON.stringify(updated, null, 2) + "\n");
  console.log(`\n${renamed.length}건을 discovered.json에 반영했습니다.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
