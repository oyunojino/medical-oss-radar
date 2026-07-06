// Detects packages that are ONLY reachable through dev/test tooling (npm
// devDependencies, pnpm devDependencies, Pipfile.lock's "develop" group) so
// they can be excluded from vulnerability counting — dev/build tooling never
// ships in the deployed artifact, so a CVE in it isn't an attack surface.
//
// Conservative by design: a package is only flagged dev-only if every lock
// file we found agrees it's never reachable from a production dependency.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const SKIP_DIR_RE = /^(node_modules|\.git|\.venv|venv|vendor|site-packages)$/;

async function findFiles(rootDir, fileName, maxDepth = 8) {
  const results = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIR_RE.test(entry.name)) continue;
        await walk(path.join(dir, entry.name), depth + 1);
      } else if (entry.name === fileName) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  await walk(rootDir, 0);
  return results;
}

function markSeen(map, key, isDev) {
  const cur = map.get(key);
  if (!cur) map.set(key, { sawDev: isDev, sawNonDev: !isDev });
  else {
    if (isDev) cur.sawDev = true;
    else cur.sawNonDev = true;
  }
}

function walkNpmLegacyTree(deps, map) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (info?.version) markSeen(map, `npm:${name}@${info.version}`, !!info.dev);
    if (info?.dependencies) walkNpmLegacyTree(info.dependencies, map);
  }
}

async function collectNpm(rootDir, map) {
  for (const file of await findFiles(rootDir, "package-lock.json")) {
    let data;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (data.packages) {
      // lockfileVersion 2/3: flat map keyed by "node_modules/.../name" with an
      // explicit `dev` flag already resolved for the full transitive tree.
      for (const [pkgPath, info] of Object.entries(data.packages)) {
        if (!pkgPath || !info?.version) continue;
        const marker = "node_modules/";
        const name = pkgPath.slice(pkgPath.lastIndexOf(marker) + marker.length);
        markSeen(map, `npm:${name}@${info.version}`, !!info.dev);
      }
    } else if (data.dependencies) {
      // lockfileVersion 1: nested dependency tree, `dev` per entry.
      walkNpmLegacyTree(data.dependencies, map);
    }
  }
}

async function collectPipfile(rootDir, map) {
  const norm = (n) => n.toLowerCase().replace(/[-_.]+/g, "-");
  const stripVersion = (v) => (v ?? "").replace(/^==/, "");
  for (const file of await findFiles(rootDir, "Pipfile.lock")) {
    let data;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    for (const [name, info] of Object.entries(data.default ?? {})) {
      markSeen(map, `pypi:${norm(name)}@${stripVersion(info.version)}`, false);
    }
    for (const [name, info] of Object.entries(data.develop ?? {})) {
      markSeen(map, `pypi:${norm(name)}@${stripVersion(info.version)}`, true);
    }
  }
}

function stripPeerSuffix(version) {
  const i = version.indexOf("(");
  return i === -1 ? version : version.slice(0, i);
}

function parseNameVersion(rawKey) {
  const scoped = rawKey.startsWith("@");
  const atIdx = scoped ? rawKey.indexOf("@", rawKey.indexOf("/")) : rawKey.indexOf("@");
  if (atIdx <= 0) return null;
  return { name: rawKey.slice(0, atIdx), version: stripPeerSuffix(rawKey.slice(atIdx + 1)) };
}

async function collectPnpm(rootDir, map) {
  for (const file of await findFiles(rootDir, "pnpm-lock.yaml")) {
    let parsed;
    try {
      parsed = parseYaml(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;

    // Workspaces nest per-package deps under `importers`; a single-package
    // repo (older/simpler lockfiles) has `dependencies`/`devDependencies` at
    // the root, which we treat as if it were the sole importer.
    const importers = parsed.importers ?? { ".": parsed };
    const rootEntries = [];
    for (const imp of Object.values(importers)) {
      if (!imp || typeof imp !== "object") continue;
      for (const [name, info] of Object.entries({
        ...(imp.dependencies ?? {}),
        ...(imp.optionalDependencies ?? {}),
      })) {
        if (info?.version) rootEntries.push({ rawKey: `${name}@${info.version}`, isDev: false });
      }
      for (const [name, info] of Object.entries(imp.devDependencies ?? {})) {
        if (info?.version) rootEntries.push({ rawKey: `${name}@${info.version}`, isDev: true });
      }
    }

    // Modern pnpm splits resolution metadata (`packages`) from the
    // dependency graph (`snapshots`); older versions keep deps inline on
    // `packages` itself.
    const graph = parsed.snapshots ?? parsed.packages ?? {};

    const visited = new Set();
    const queue = rootEntries.filter((r) => !r.isDev).map((r) => r.rawKey);
    while (queue.length) {
      const key = queue.pop();
      if (visited.has(key)) continue;
      visited.add(key);
      const node = graph[key];
      if (!node) continue;
      for (const [depName, depVersion] of Object.entries({
        ...(node.dependencies ?? {}),
        ...(node.optionalDependencies ?? {}),
      })) {
        if (typeof depVersion === "string") queue.push(`${depName}@${depVersion}`);
      }
    }

    const allRawKeys = new Set([...rootEntries.map((r) => r.rawKey), ...Object.keys(graph)]);
    for (const rawKey of allRawKeys) {
      const parsedKey = parseNameVersion(rawKey);
      if (!parsedKey) continue;
      markSeen(map, `npm:${parsedKey.name}@${parsedKey.version}`, !visited.has(rawKey));
    }
  }
}

/** Returns a Set of "npm:name@version" / "pypi:name@version" keys that are
 *  confirmed dev-only across every lock file found under rootDir. */
export async function detectDevOnlyPackages(rootDir) {
  const map = new Map();
  await Promise.all([
    collectNpm(rootDir, map),
    collectPnpm(rootDir, map),
    collectPipfile(rootDir, map),
  ]);

  const devOnly = new Set();
  for (const [key, { sawDev, sawNonDev }] of map) {
    if (sawDev && !sawNonDev) devOnly.add(key);
  }
  return devOnly;
}
