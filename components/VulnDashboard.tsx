"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProjectWithCategory } from "@/lib/projects";
import { SeverityLevel, SEVERITY_ORDER, VulnSummary } from "@/lib/severity";
import { SeverityBar, SEVERITY_COLOR } from "./SeverityBar";
import { StatCard } from "./StatCard";

export type VulnRow = {
  slug: string;
  project?: ProjectWithCategory;
  summary: VulnSummary | null;
  /** True if scripts/vex-scan.mjs has run against this slug (top-N pilot). */
  vexScanned?: boolean;
};

const EMPTY_SEVERITY: Record<SeverityLevel, number> = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
  UNKNOWN: 0,
};

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4,
};

const STAT_ACCENT: Partial<Record<SeverityLevel, string>> = {
  CRITICAL: "text-coral",
  HIGH: "text-coral",
  MEDIUM: "text-amber",
  LOW: "text-vital",
};

function worstSeverity(summary: VulnSummary | null): SeverityLevel {
  if (!summary) return "UNKNOWN";
  for (const level of SEVERITY_ORDER) {
    if (summary.bySeverity[level] > 0) return level;
  }
  return "UNKNOWN";
}

function isKevListed(summary: VulnSummary | null): boolean {
  return (summary?.kevCount ?? 0) > 0;
}

function matches(row: VulnRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.slug.toLowerCase().includes(q) ||
    (row.project?.name.toLowerCase().includes(q) ?? false)
  );
}

export function VulnDashboard({
  rows,
  lastScanned,
  globalStats,
  vexCoverage,
}: {
  rows: VulnRow[];
  lastScanned?: string;
  globalStats: { vulnCount: number; bySeverity: Record<SeverityLevel, number>; kevCount: number };
  vexCoverage?: { scannedSlugs: number; totalSlugs: number };
}) {
  const [query, setQuery] = useState("");
  const [onlyVulnerable, setOnlyVulnerable] = useState(false);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        // Actively-exploited-in-the-wild (KEV) outranks raw CVSS severity —
        // a MEDIUM being exploited today matters more than an unexploited CRITICAL.
        const ak = isKevListed(a.summary) ? 0 : 1;
        const bk = isKevListed(b.summary) ? 0 : 1;
        if (ak !== bk) return ak - bk;
        const aw = SEVERITY_RANK[worstSeverity(a.summary)];
        const bw = SEVERITY_RANK[worstSeverity(b.summary)];
        if (aw !== bw) return aw - bw;
        return (b.summary?.vulnCount ?? 0) - (a.summary?.vulnCount ?? 0);
      }),
    [rows]
  );

  const filtered = useMemo(
    () =>
      sorted.filter(
        (r) => matches(r, query) && (!onlyVulnerable || (r.summary?.vulnCount ?? 0) > 0)
      ),
    [sorted, query, onlyVulnerable]
  );

  const totals = useMemo(() => {
    let vulnerableProjects = 0;
    for (const r of rows) {
      if (r.summary && r.summary.vulnCount > 0) vulnerableProjects++;
    }
    // bySeverity/totalVulns/kevCount come from globalStats (props), not summed
    // per-project: the same vuln+component+version affecting many projects must
    // count once for the ecosystem, not once per project it happens to appear in.
    return {
      bySeverity: globalStats.bySeverity,
      vulnerableProjects,
      totalVulns: globalStats.vulnCount,
      kevCount: globalStats.kevCount,
    };
  }, [rows, globalStats]);

  const top = sorted.filter((r) => (r.summary?.vulnCount ?? 0) > 0).slice(0, 10);
  const kevListed = sorted.filter((r) => isKevListed(r.summary));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-tagcode text-vital">
            MEDREG · VULNERABILITIES
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            취약점 스캔 대시보드
          </h1>
          <p className="mt-1 text-sm text-muted">
            <code className="font-mono">npm run osv</code>가 SBOM 패키지를{" "}
            <a
              href="https://osv.dev"
              target="_blank"
              rel="noreferrer"
              className="text-vital hover:underline"
            >
              OSV.dev
            </a>{" "}
            데이터베이스와 대조해 찾은 알려진 취약점입니다. CVE/GHSA/PYSEC 등 동일 취약점의
            서로 다른 식별자는 하나로 묶고, (취약점, 컴포넌트, 버전) 조합 기준으로 프로젝트 간
            중복도 제거한 수치입니다.
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
          {lastScanned && (
            <p className="font-mono text-[0.7rem] text-muted/80">
              LAST SCANNED {new Date(lastScanned).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="스캔된 프로젝트" value={rows.length} />
        <StatCard label="취약 프로젝트" value={totals.vulnerableProjects} accent="text-coral" />
        <StatCard label="고유 취약점" value={totals.totalVulns} />
        <StatCard label="KEV 등재 (실제 악용)" value={totals.kevCount} accent="text-coral" />
        {SEVERITY_ORDER.filter((l) => l !== "UNKNOWN").map((level) => (
          <StatCard
            key={level}
            label={level}
            value={totals.bySeverity[level]}
            accent={STAT_ACCENT[level]}
          />
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-semibold text-ink">전체 심각도 분포</h2>
        <SeverityBar counts={totals.bySeverity} className="h-3" />
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[0.7rem] text-muted">
          {SEVERITY_ORDER.map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SEVERITY_COLOR[level] }}
              />
              {level} {totals.bySeverity[level]}
            </span>
          ))}
        </div>
      </section>

      {vexCoverage && vexCoverage.totalSlugs > 0 && (
        <section className="mb-10 rounded-md border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">VEX 판정 파일럿</h2>
            <span className="font-mono text-xs text-muted">
              적용 {vexCoverage.scannedSlugs}/{vexCoverage.totalSlugs}개 프로젝트
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            OSV는 "이 버전에 CVE가 있다"까지만 판단하고 실제 실행 여부는 보지 않습니다. 취약점 수
            상위 프로젝트부터 fix 커밋과 실제 배포 소스를 대조해 취약 코드가 남아있지 않은 경우를
            자동으로 걸러내는 VEX 판정을 시범 적용 중이며, 나머지 프로젝트는 아직 검증 대상에
            포함되지 않았습니다. 위 취약점 통계는 이 파일럿과 무관하게 원래 집계 방식 그대로입니다.
          </p>
        </section>
      )}

      {kevListed.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex items-baseline gap-3">
            <span className="rounded-full bg-coral px-2 py-0.5 font-mono text-xs tracking-tagcode text-paper">
              KEV · {kevListed.length}
            </span>
            <h2 className="text-lg font-semibold text-ink">실제 악용 확인됨 (CISA KEV)</h2>
          </div>
          <p className="mb-3 text-xs text-muted">
            미국 CISA가 실제 공격에 악용된 것으로 확인한 CVE입니다. CVSS 심각도와 무관하게 최우선
            패치 대상입니다.
          </p>
          <div className="chart-rule mb-3" />
          <div className="flex flex-col gap-2">
            {kevListed.map((row) => (
              <Link
                key={row.slug}
                href={`/vulnerabilities/${row.slug}`}
                className="flex items-center gap-4 rounded-md border border-coral/40 bg-coral-soft px-4 py-2.5 transition hover:border-coral"
              >
                <span className="w-36 shrink-0 truncate font-mono text-sm text-ink sm:w-44">
                  {row.project?.name ?? row.slug}
                </span>
                <SeverityBar counts={row.summary!.bySeverity} className="h-2 flex-1" />
                <span className="w-16 shrink-0 text-right font-mono text-xs text-coral">
                  KEV {row.summary!.kevCount}건
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {top.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex items-baseline gap-3">
            <span className="font-mono text-xs tracking-tagcode text-coral">
              RISK · TOP {top.length}
            </span>
            <h2 className="text-lg font-semibold text-ink">위험도 높은 프로젝트</h2>
          </div>
          <div className="chart-rule mb-3" />
          <div className="flex flex-col gap-2">
            {top.map((row, i) => (
              <Link
                key={row.slug}
                href={`/vulnerabilities/${row.slug}`}
                className="flex items-center gap-4 rounded-md border border-line bg-panel px-4 py-2.5 transition hover:border-coral/50"
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <span className="w-36 shrink-0 truncate font-mono text-sm text-ink sm:w-44">
                  {row.project?.name ?? row.slug}
                </span>
                <SeverityBar counts={row.summary!.bySeverity} className="h-2 flex-1" />
                <span className="w-16 shrink-0 text-right font-mono text-xs text-muted">
                  {row.summary!.vulnCount}건
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            전체 프로젝트 ({filtered.length}/{rows.length})
          </h2>
          <label className="flex items-center gap-2 font-mono text-xs text-muted">
            <input
              type="checkbox"
              checked={onlyVulnerable}
              onChange={(e) => setOnlyVulnerable(e.target.checked)}
              className="accent-coral"
            />
            취약점 있는 프로젝트만
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            조건에 맞는 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <Link
                key={row.slug}
                href={`/vulnerabilities/${row.slug}`}
                className="rounded-md border border-line bg-panel p-4 transition hover:border-vital/50"
              >
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[0.7rem] text-muted/80">
                    {row.project?.categoryCode ?? "—"}
                  </p>
                  {row.vexScanned && (
                    <span className="rounded-full border border-vital/50 px-1.5 py-0.5 font-mono text-[0.6rem] text-vital">
                      VEX 파일럿
                    </span>
                  )}
                  {isKevListed(row.summary) && (
                    <span className="rounded-full bg-coral px-1.5 py-0.5 font-mono text-[0.6rem] text-paper">
                      KEV
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-semibold text-ink">
                  {row.project?.name ?? row.slug}
                </h3>
                {row.project?.owner && row.project?.repo && (
                  <p className="text-xs text-muted">
                    {row.project.owner}/{row.project.repo}
                  </p>
                )}
                <SeverityBar
                  counts={row.summary?.bySeverity ?? EMPTY_SEVERITY}
                  className="mt-3 h-2"
                />
                <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted">
                  <span>
                    {row.summary && row.summary.vulnCount > 0
                      ? `취약점 ${row.summary.vulnCount}건`
                      : "취약점 없음"}
                  </span>
                  <span>{row.summary?.affectedComponentCount ?? 0}개 구성요소 영향</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
