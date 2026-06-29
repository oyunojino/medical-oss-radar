#!/usr/bin/env node
// Generates CycloneDX + SPDX SBOMs (via syft) for every GitHub-hosted project
// tracked in lib/projects.ts and lib/discovered.json.
//
// For each project: shallow git clone -> syft scan -> write sboms/<slug>.{cdx,spdx}.json
// -> delete the clone. Sequential, with a per-repo timeout, so one huge/stuck
// repo can't hang the whole run.
//
// Usage: npm run sbom            (all projects)
//        npm run sbom -- openmrs pydicom   (only these slugs)

import { readFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_TS = path.join(ROOT, "lib", "projects.ts");
const DISCOVERED_JSON = path.join(ROOT, "lib", "discovered.json");
const WORK_DIR = path.join(ROOT, "sbom-work");
const OUT_DIR = path.join(ROOT, "sboms");
const SYFT = path.join(ROOT, "tools", "bin", "syft.exe");

const CLONE_TIMEOUT_MS = 5 * 60 * 1000;
const SCAN_TIMEOUT_MS = 5 * 60 * 1000;

function extractCuratedProjects(text) {
  // `slug: "...", \n name: "...",` marks a project entry (categories have
  // `slug: "...", \n title:` instead, so this never matches a category).
  const headerRe = /slug:\s*"([^"]+)"\s*,\s*\n\s*name:\s*"([^"]+)"/g;
  const ownerRepoRe = /owner:\s*"([^"]+)"\s*,\s*\n\s*repo:\s*"([^"]+)"/;

  const headers = [];
  let m;
  while ((m = headerRe.exec(text))) {
    headers.push({ slug: m[1], index: m.index });
  }

  return headers
    .map((h, i) => {
      const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
      const window = text.slice(h.index, end);
      const or = ownerRepoRe.exec(window);
      return { slug: h.slug, owner: or?.[1], repo: or?.[2] };
    })
    .filter((p) => p.owner && p.repo);
}

async function loadAllProjects() {
  const [projectsText, discoveredText] = await Promise.all([
    readFile(PROJECTS_TS, "utf8"),
    readFile(DISCOVERED_JSON, "utf8").catch(() => "[]"),
  ]);

  const curated = extractCuratedProjects(projectsText);
  const discovered = JSON.parse(discoveredText || "[]")
    .filter((p) => p.owner && p.repo)
    .map((p) => ({ slug: p.slug, owner: p.owner, repo: p.repo }));

  const byKey = new Map();
  for (const p of [...curated, ...discovered]) {
    byKey.set(`${p.owner}/${p.repo}`.toLowerCase(), p);
  }
  return [...byKey.values()];
}

function run(cmd, args, { cwd, timeoutMs } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      windowsHide: true,
    });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, reason: `timeout (${timeoutMs}ms)` });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, reason: stderr.trim().slice(-400) || `exit ${code}` });
    });
  });
}

async function safeRm(dir, tag) {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 });
  } catch (err) {
    // Windows occasionally keeps a brief handle open (AV scan, git.exe exit
    // lag) right after clone/scan. Leftover dirs are harmless — the next
    // clone of the same slug force-overwrites them — so don't let this kill
    // the whole batch.
    console.warn(`${tag} — 임시 폴더 삭제 실패(무시하고 계속): ${err.message}`);
  }
}

async function processProject(project, index, total) {
  const { slug, owner, repo } = project;
  const tag = `[${index + 1}/${total}] ${slug} (${owner}/${repo})`;
  const cloneDir = path.join(WORK_DIR, slug);

  try {
    console.log(`${tag} — cloning...`);
    await safeRm(cloneDir, tag);
    const clone = await run(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
        `https://github.com/${owner}/${repo}.git`,
        cloneDir,
      ],
      { timeoutMs: CLONE_TIMEOUT_MS }
    );
    if (!clone.ok) {
      console.warn(`${tag} — clone 실패: ${clone.reason}`);
      return { slug, ok: false, stage: "clone", reason: clone.reason };
    }

    console.log(`${tag} — scanning with syft...`);
    const cdxPath = path.join(OUT_DIR, `${slug}.cdx.json`);
    const spdxPath = path.join(OUT_DIR, `${slug}.spdx.json`);

    const cdx = await run(
      SYFT,
      ["scan", `dir:${cloneDir}`, "-o", `cyclonedx-json=${cdxPath}`, "-q"],
      { timeoutMs: SCAN_TIMEOUT_MS }
    );
    const spdx = await run(
      SYFT,
      ["scan", `dir:${cloneDir}`, "-o", `spdx-json=${spdxPath}`, "-q"],
      { timeoutMs: SCAN_TIMEOUT_MS }
    );

    if (!cdx.ok || !spdx.ok) {
      console.warn(
        `${tag} — scan 실패: cdx=${cdx.ok ? "ok" : cdx.reason} spdx=${
          spdx.ok ? "ok" : spdx.reason
        }`
      );
      return { slug, ok: false, stage: "scan", reason: cdx.reason || spdx.reason };
    }

    console.log(`${tag} — 완료`);
    return { slug, ok: true };
  } catch (err) {
    console.warn(`${tag} — 예외 발생(다음 프로젝트로 진행): ${err.message}`);
    return { slug, ok: false, stage: "exception", reason: err.message };
  } finally {
    await safeRm(cloneDir, tag);
  }
}

async function main() {
  if (!existsSync(SYFT)) {
    console.error(`syft 바이너리를 찾을 수 없습니다: ${SYFT}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(WORK_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const all = await loadAllProjects();
  const only = process.argv.slice(2);
  const targets = only.length
    ? all.filter((p) => only.includes(p.slug))
    : all;

  console.log(`대상 ${targets.length}건 (전체 추적 중인 GitHub 프로젝트 ${all.length}건 중)\n`);

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    results.push(await processProject(targets[i], i, targets.length));
  }

  await safeRm(WORK_DIR, "[cleanup]");

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n완료: ${ok}/${results.length}건 성공, ${failed.length}건 실패.`);
  if (failed.length) {
    console.log("실패 목록:");
    for (const f of failed) console.log(`  - ${f.slug} (${f.stage}: ${f.reason})`);
  }
  console.log(`SBOM 출력 위치: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
