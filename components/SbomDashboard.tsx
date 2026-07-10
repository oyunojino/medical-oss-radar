"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProjectWithCategory } from "@/lib/projects";
import type { SbomSummary } from "@/lib/sbom";
import { ExpandableGrid } from "./ExpandableGrid";
import { StatCard } from "./StatCard";
import { RankBar } from "./StackedBar";

const INITIAL_VISIBLE = 24;

export type SbomRow = {
  slug: string;
  project?: ProjectWithCategory;
  summary: SbomSummary | null;
};

function matches(row: SbomRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.slug.toLowerCase().includes(q) ||
    (row.project?.name.toLowerCase().includes(q) ?? false)
  );
}

export function SbomDashboard({ rows }: { rows: SbomRow[] }) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => (b.summary?.componentCount ?? 0) - (a.summary?.componentCount ?? 0)
      ),
    [rows]
  );

  const filtered = useMemo(() => sorted.filter((r) => matches(r, query)), [sorted, query]);

  const totals = useMemo(() => {
    let componentCount = 0;
    let licenseCount = 0;
    const ecosystems = new Set<string>();
    for (const r of rows) {
      if (!r.summary) continue;
      componentCount += r.summary.componentCount;
      licenseCount += r.summary.licenseCount;
      for (const e of r.summary.ecosystems) ecosystems.add(e.name);
    }
    return { componentCount, licenseCount, ecosystemCount: ecosystems.size };
  }, [rows]);

  const maxComponents = Math.max(1, ...sorted.map((r) => r.summary?.componentCount ?? 0));
  const top = sorted.slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-tagcode text-vital">MEDREG · SBOM</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            소프트웨어 구성요소 명세서 (SBOM)
          </h1>
          <p className="mt-1 text-sm text-muted">
            <code className="font-mono">npm run sbom</code>이 syft로 생성한
            CycloneDX/SPDX 결과입니다. {rows.length}개 프로젝트 — 대상 전체가 끝나기
            전까지 목록은 계속 늘어납니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트 이름으로 검색"
            className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-vital/40 sm:w-64"
          />
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="스캔된 프로젝트" value={rows.length} />
        <StatCard label="총 구성요소" value={totals.componentCount} accent="text-vital" />
        <StatCard label="고유 라이선스" value={totals.licenseCount} accent="text-amber" />
        <StatCard label="패키지 생태계" value={totals.ecosystemCount} />
      </section>

      {top.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex items-baseline gap-3">
            <span className="font-mono text-xs tracking-tagcode text-vital">
              SIZE · TOP {top.length}
            </span>
            <h2 className="text-lg font-semibold text-ink">구성요소 많은 프로젝트</h2>
          </div>
          <div className="chart-rule mb-3" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((row) => (
              <Link
                key={row.slug}
                href={`/sbom/${row.slug}`}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-4 py-2.5 transition hover:border-vital/50"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[0.65rem] text-muted/80">
                    {row.project?.categoryCode ?? "—"}
                  </p>
                  <p className="truncate text-sm font-medium text-ink">
                    {row.project?.name ?? row.slug}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-vital/50 px-2 py-0.5 font-mono text-xs text-vital">
                  구성요소 {row.summary?.componentCount ?? 0}개
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">
          전체 프로젝트 ({filtered.length}/{rows.length})
        </h2>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            조건에 맞는 프로젝트가 없습니다.
          </p>
        ) : (
          <ExpandableGrid
            items={filtered}
            initialCount={INITIAL_VISIBLE}
            forceExpand={query.trim() !== ""}
            keyOf={(row) => row.slug}
            renderItem={(row) => (
              <Link
                href={`/sbom/${row.slug}`}
                className="rounded-md border border-line bg-panel p-4 transition hover:border-vital/50"
              >
                <p className="font-mono text-[0.7rem] text-muted/80">
                  {row.project?.categoryCode ?? "—"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-ink">
                  {row.project?.name ?? row.slug}
                </h3>
                {row.project?.owner && row.project?.repo && (
                  <p className="text-xs text-muted">
                    {row.project.owner}/{row.project.repo}
                  </p>
                )}
                <RankBar
                  value={row.summary?.componentCount ?? 0}
                  max={maxComponents}
                  className="mt-3 h-2"
                />
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
                  <span>구성요소 {row.summary?.componentCount ?? 0}</span>
                  <span>라이선스 {row.summary?.licenseCount ?? 0}</span>
                </div>
                {row.summary && row.summary.ecosystems.length > 0 && (
                  <p className="mt-2 truncate text-xs text-muted/80">
                    {row.summary.ecosystems
                      .slice(0, 4)
                      .map((e) => `${e.name}(${e.count})`)
                      .join(" · ")}
                  </p>
                )}
              </Link>
            )}
          />
        )}
      </section>
    </div>
  );
}
