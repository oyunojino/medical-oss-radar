import Link from "next/link";
import { notFound } from "next/navigation";
import { allProjects } from "@/lib/projects";
import { buildVulnIndex, loadKevDb, loadVulnDb, readSlugReport, summarizeReport } from "@/lib/osv";
import { SEVERITY_ORDER } from "@/lib/severity";
import { SeverityBar, SEVERITY_COLOR } from "@/components/SeverityBar";
import { findVexForCanonical, indexVexEntries, readSlugVex, VexEntry } from "@/lib/vex";
import { AffectedRow } from "@/components/VulnAffectedTable";
import { VulnCardData } from "@/components/VulnCardList";
import { VulnTabs } from "@/components/VulnTabs";

export const dynamic = "force-dynamic";

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

  // VulnAffectedTable is a client component (search + pagination), so `index`
  // (a bundle of closures over Maps) can't be passed to it as a prop — resolve
  // everything it needs into plain data here first.
  const affectedRows: AffectedRow[] = report.affected.map((c) => ({
    name: c.name,
    version: c.version,
    purl: c.purl,
    vulns: [...new Set(c.vulnIds.map((id) => index.canonicalId(id)))].map((canonicalId) => ({
      canonicalId,
      displayId: index.representative(canonicalId)?.id ?? canonicalId,
      severity: index.severityOf(canonicalId),
      kev: index.kevInfo(canonicalId),
      vex: findVexForCanonical(vexMap, index, canonicalId, c.name, c.version ?? ""),
    })),
  }));

  // Same server->client plain-data constraint as affectedRows above. A VEX
  // status is per (component, vuln) pair, but this card is per canonical vuln
  // — so a vuln affecting several components can have several VEX verdicts.
  // Conservative rollup: only call it "영향없음" when EVERY affected pairing
  // was cleared; any unresolved or unchecked pairing keeps it out of that
  // bucket, matching this project's "never overstate safety" rule.
  const vulnCards: VulnCardData[] = canonicalIds.map((canonicalId) => {
    const vuln = index.representative(canonicalId);
    const displayId = vuln?.id ?? canonicalId;
    const affectedComponents = report.affected.filter((c) =>
      c.vulnIds.some((id) => index.canonicalId(id) === canonicalId)
    );
    const vexEntries = affectedComponents
      .map((c) => findVexForCanonical(vexMap, index, canonicalId, c.name, c.version ?? ""))
      .filter((e): e is VexEntry => Boolean(e));
    const vexStatus =
      vexEntries.length === 0
        ? ("unreviewed" as const)
        : vexEntries.every((e) => e.status === "not_affected")
          ? ("not_affected" as const)
          : ("under_investigation" as const);

    return {
      canonicalId,
      displayId,
      severity: index.severityOf(canonicalId),
      kev: index.kevInfo(canonicalId),
      aliases: index.membersOf(canonicalId).filter((m) => m !== displayId),
      summary: vuln?.summary || "요약 정보 없음",
      affectedNames: affectedComponents.map((c) => `${c.name}${c.version ? `@${c.version}` : ""}`),
      vexStatus,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-2 border-b border-line pb-6">
        <Link
          href="/vulnerabilities"
          className="self-start rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink transition hover:border-vital/50 hover:text-vital"
        >
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

        <Link
          href={`/sbom/${params.slug}`}
          className="mt-1 self-start rounded-md border border-vital/50 bg-vital-soft px-3 py-1.5 font-mono text-xs text-vital transition hover:border-vital"
        >
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
        <VulnTabs vulnCards={vulnCards} affectedRows={affectedRows} />
      )}
    </div>
  );
}
