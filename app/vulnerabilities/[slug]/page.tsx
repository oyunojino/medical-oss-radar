import Link from "next/link";
import { notFound } from "next/navigation";
import { allProjects } from "@/lib/projects";
import { buildVulnIndex, loadKevDb, loadVulnDb, readSlugReport, summarizeReport } from "@/lib/osv";
import { KevEntry, SEVERITY_ORDER, SeverityLevel } from "@/lib/severity";
import { SeverityBar, SEVERITY_COLOR } from "@/components/SeverityBar";
import { findVexForCanonical, indexVexEntries, readSlugVex, VexEntry } from "@/lib/vex";

export const dynamic = "force-dynamic";

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  CRITICAL: "border-coral bg-coral-soft text-coral",
  HIGH: "border-coral/60 bg-coral-soft text-coral",
  MEDIUM: "border-amber bg-amber-soft text-amber",
  LOW: "border-vital/60 bg-vital-soft text-vital",
  UNKNOWN: "border-line bg-panel text-muted",
};

/** VEX pilot status pill for one (component, canonical vuln) pair. Renders
 *  nothing when `entry` is undefined — that means either this repo was never
 *  in the pilot's top-N, or this specific pair was never eligible (wrong
 *  ecosystem, no fix-commit data) — silence is intentional, not an omission,
 *  see the plan this pilot was built against. */
function VexPill({ entry }: { entry: VexEntry | undefined }) {
  if (!entry) return null;

  if (entry.status === "not_affected") {
    return (
      <details className="inline-block align-middle">
        <summary className="inline-block cursor-pointer list-none rounded-full border border-vital/50 bg-vital-soft px-2 py-0.5 font-mono text-[0.7rem] text-vital">
          VEX: 영향 없음
        </summary>
        <div className="mt-1 max-w-xs rounded-md border border-line bg-panel p-2 text-[0.7rem] text-muted">
          <p>
            근거: 취약 함수가 실제 배포 버전 소스에 없음 (
            {entry.evidence.functionNamesChecked.join(", ") || "함수명 없음"})
          </p>
          {entry.evidence.fixCommits[0] && (
            <a
              href={entry.evidence.fixCommits[0].url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-vital hover:underline"
            >
              fix 커밋 보기 →
            </a>
          )}
          <p className="mt-1">
            검색한 파일 {entry.evidence.filesSearched}건
            {entry.evidence.filesSkippedMinified > 0 &&
              ` (minified/bundled ${entry.evidence.filesSkippedMinified}건 제외)`}
          </p>
        </div>
      </details>
    );
  }

  return (
    <span
      title={entry.evidence.reason ?? undefined}
      className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.7rem] text-muted"
    >
      VEX: 조사 중
    </span>
  );
}

/** CISA KEV badge — renders nothing when `entry` is undefined (this CVE isn't
 *  in the catalog, or vulns/_kev.json hasn't been generated yet via `npm run
 *  kev`). Presence in KEV is a binary fact from an authoritative government
 *  source, so unlike VexPill there's no "ambiguous" state to represent. */
function KevPill({ entry }: { entry: KevEntry | undefined }) {
  if (!entry) return null;

  return (
    <details className="inline-block align-middle">
      <summary className="inline-block cursor-pointer list-none rounded-full bg-coral px-2 py-0.5 font-mono text-[0.7rem] text-paper">
        ⚠ KEV — 실제 악용 확인됨
      </summary>
      <div className="mt-1 max-w-xs rounded-md border border-coral/40 bg-coral-soft p-2 text-[0.7rem] text-ink">
        <p className="font-semibold">{entry.vulnerabilityName}</p>
        <p className="mt-1">등재일 {entry.dateAdded} · 조치 기한 {entry.dueDate}</p>
        <p className="mt-1">
          랜섬웨어 악용:{" "}
          {entry.knownRansomwareCampaignUse === "Known" ? "확인됨" : "미확인"}
        </p>
      </div>
    </details>
  );
}

export default async function VulnerabilityDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const report = await readSlugReport(params.slug);
  if (!report) notFound();

  const [db, kevDb] = await Promise.all([loadVulnDb(), loadKevDb()]);
  const index = buildVulnIndex(db, kevDb);
  const summary = summarizeReport(params.slug, report, db, index);
  const project = allProjects.find((p) => p.slug === params.slug);

  const vexReport = await readSlugVex(params.slug);
  const vexMap = indexVexEntries(vexReport);

  // Group by canonical id so a CVE and its GHSA/PYSEC/... aliases render as one card.
  const canonicalIds = [
    ...new Set(report.affected.flatMap((c) => c.vulnIds.map((id) => index.canonicalId(id)))),
  ].sort(
    (a, b) => SEVERITY_ORDER.indexOf(index.severityOf(a)) - SEVERITY_ORDER.indexOf(index.severityOf(b))
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-2 border-b border-line pb-6">
        <Link href="/vulnerabilities" className="text-sm text-vital hover:underline">
          ← 취약점 목록으로
        </Link>
        <p className="font-mono text-xs tracking-tagcode text-vital">
          {project?.categoryCode ?? "VULN"}
        </p>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          {project?.name ?? params.slug}
        </h1>
        {project?.owner && project?.repo && (
          <a
            href={`https://github.com/${project.owner}/${project.repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted hover:text-ink"
          >
            github.com/{project.owner}/{project.repo}
          </a>
        )}

        <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
          <span>구성요소 {report.componentCount}</span>
          <span>영향받는 구성요소 {summary.affectedComponentCount}</span>
          <span>고유 취약점 {summary.vulnCount}</span>
          {report.scannedAt && (
            <span>스캔 {new Date(report.scannedAt).toLocaleString("ko-KR")}</span>
          )}
        </div>

        <Link href={`/sbom/${params.slug}`} className="mt-1 text-sm text-vital hover:underline">
          이 프로젝트의 SBOM 보기 →
        </Link>

        {summary.vulnCount > 0 && (
          <div className="mt-3">
            <SeverityBar counts={summary.bySeverity} className="h-2.5" />
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[0.7rem] text-muted">
              {SEVERITY_ORDER.filter((level) => summary.bySeverity[level] > 0).map((level) => (
                <span key={level} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: SEVERITY_COLOR[level] }}
                  />
                  {level} {summary.bySeverity[level]}
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {summary.vulnCount === 0 ? (
        <p className="py-16 text-center text-sm text-vital">
          OSV.dev 기준 알려진 취약점이 발견되지 않았습니다.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              취약점 ({canonicalIds.length})
            </h2>
            <div className="flex flex-col gap-3">
              {canonicalIds.map((canonicalId) => {
                const vuln = index.representative(canonicalId);
                const severity = index.severityOf(canonicalId);
                const displayId = vuln?.id ?? canonicalId;
                const aliases = index.membersOf(canonicalId).filter((m) => m !== displayId);
                const affectedNames = report.affected
                  .filter((c) => c.vulnIds.some((id) => index.canonicalId(id) === canonicalId))
                  .map((c) => `${c.name}${c.version ? `@${c.version}` : ""}`);
                return (
                  <div key={canonicalId} className="rounded-md border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`https://osv.dev/vulnerability/${displayId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm font-semibold text-vital hover:underline"
                      >
                        {displayId}
                      </a>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[0.7rem] ${SEVERITY_BADGE[severity]}`}
                      >
                        {severity}
                      </span>
                      <KevPill entry={index.kevInfo(canonicalId)} />
                      {aliases.slice(0, 3).map((alias) => (
                        <span
                          key={alias}
                          className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.7rem] text-muted"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      {vuln?.summary || "요약 정보 없음"}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      영향받는 구성요소: {affectedNames.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              영향받는 구성요소 ({summary.affectedComponentCount})
            </h2>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">이름</th>
                    <th className="px-3 py-2">버전</th>
                    <th className="px-3 py-2">취약점</th>
                  </tr>
                </thead>
                <tbody>
                  {report.affected.map((c) => (
                    <tr key={c.purl} className="border-t border-line">
                      <td className="px-3 py-1.5 font-mono text-ink">{c.name}</td>
                      <td className="px-3 py-1.5 text-muted">{c.version ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {[...new Set(c.vulnIds.map((id) => index.canonicalId(id)))].map(
                            (canonicalId) => {
                              const displayId = index.representative(canonicalId)?.id ?? canonicalId;
                              const vexEntry = findVexForCanonical(
                                vexMap,
                                index,
                                canonicalId,
                                c.name,
                                c.version ?? ""
                              );
                              return (
                                <span key={canonicalId} className="inline-flex items-center gap-1">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 font-mono text-[0.7rem] ${SEVERITY_BADGE[index.severityOf(canonicalId)]}`}
                                  >
                                    {displayId}
                                  </span>
                                  <VexPill entry={vexEntry} />
                                  <KevPill entry={index.kevInfo(canonicalId)} />
                                </span>
                              );
                            }
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
