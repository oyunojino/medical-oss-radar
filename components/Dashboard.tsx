"use client";

import { useMemo, useState } from "react";
import { Project } from "@/lib/projects";
import { RepoResult } from "@/lib/github";
import { daysSince, VitalStatus, vitalStatus } from "@/lib/time";
import { ProjectCard } from "./ProjectCard";
import { StatCard } from "./StatCard";
import { StackedBar } from "./StackedBar";

const STATUS_COLOR: Record<VitalStatus, string> = {
  active: "#0F9D8C",
  aging: "#C98A1D",
  dormant: "#C4453B",
};

const STATUS_LABEL: Record<VitalStatus, string> = {
  active: "ACTIVE",
  aging: "AGING",
  dormant: "DORMANT",
};

export type CategoryWithResults = {
  code: string;
  slug: string;
  title: string;
  subtitle: string;
  items: { project: Project; result: RepoResult }[];
};

function matches(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    project.name.toLowerCase().includes(q) ||
    project.description.toLowerCase().includes(q) ||
    project.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function Dashboard({
  categories,
  lastSynced,
}: {
  categories: CategoryWithResults[];
  lastSynced: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      categories
        .map((c) => ({
          ...c,
          items: c.items.filter(({ project }) => matches(project, query)),
        }))
        .filter((c) => c.items.length > 0),
    [categories, query]
  );

  const totalCount = categories.reduce((n, c) => n + c.items.length, 0);
  const visibleCount = filtered.reduce((n, c) => n + c.items.length, 0);

  const stats = useMemo(() => {
    const byStatus: Record<VitalStatus, number> = { active: 0, aging: 0, dormant: 0 };
    let totalStars = 0;
    let tracked = 0;
    let untracked = 0;

    for (const category of categories) {
      for (const { result } of category.items) {
        if (!result.ok) {
          untracked++;
          continue;
        }
        tracked++;
        totalStars += result.stats.stars;
        byStatus[vitalStatus(daysSince(result.stats.pushedAt), result.stats.archived)]++;
      }
    }

    return { byStatus, totalStars, tracked, untracked };
  }, [categories]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-tagcode text-vital">
            MEDREG · OSS RADAR
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            의료 오픈소스 활동 모니터
          </h1>
          <p className="mt-1 text-sm text-muted">
            분야별로 정리한 의료 · 의료기기 오픈소스 {totalCount}건의 활동 신호를
            추적합니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 설명, 태그로 검색"
            className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-vital/40 sm:w-64"
          />
          <p className="font-mono text-[0.7rem] text-muted/80">
            LAST SYNCED {lastSynced} · {visibleCount}/{totalCount} SHOWN
          </p>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="전체 프로젝트" value={totalCount} />
        <StatCard label="카테고리" value={categories.length} />
        <StatCard label="ACTIVE" value={stats.byStatus.active} accent="text-vital" />
        <StatCard label="AGING" value={stats.byStatus.aging} accent="text-amber" />
        <StatCard label="DORMANT" value={stats.byStatus.dormant} accent="text-coral" />
        <StatCard label="총 스타" value={stats.totalStars} />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-semibold text-ink">활동 상태 분포</h2>
        <StackedBar
          className="h-3"
          segments={(["active", "aging", "dormant"] as VitalStatus[]).map((status) => ({
            key: status,
            count: stats.byStatus[status],
            color: STATUS_COLOR[status],
            label: STATUS_LABEL[status],
          }))}
        />
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[0.7rem] text-muted">
          {(["active", "aging", "dormant"] as VitalStatus[]).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[status] }}
              />
              {STATUS_LABEL[status]} {stats.byStatus[status]}
            </span>
          ))}
          {stats.untracked > 0 && (
            <span className="text-muted/70">GitHub 통계 없음 {stats.untracked}건</span>
          )}
        </div>
      </section>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">
          “{query}”와 일치하는 프로젝트가 없습니다. 다른 키워드로 검색해보세요.
        </p>
      )}

      <div className="flex flex-col gap-12">
        {filtered.map((category) => (
          <section key={category.slug}>
            <div className="mb-1 flex items-baseline gap-3">
              <span className="font-mono text-xs tracking-tagcode text-vital">
                {category.code}
              </span>
              <h2 className="text-lg font-semibold text-ink">
                {category.title}
              </h2>
            </div>
            <div className="chart-rule mb-1" />
            <p className="mb-4 text-sm text-muted">{category.subtitle}</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map(({ project, result }) => (
                <ProjectCard
                  key={project.slug}
                  project={project}
                  result={result}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-16 border-t border-line pt-6 font-mono text-[0.7rem] text-muted/80">
        데이터는 GitHub API 기준 1시간마다 갱신됩니다 · 새 프로젝트는
        lib/projects.ts 에 추가하세요
      </footer>
    </div>
  );
}
