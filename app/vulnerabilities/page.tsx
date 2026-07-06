import { allProjects } from "@/lib/projects";
import {
  buildVulnIndex,
  listVulnSlugs,
  loadVulnDb,
  readSlugReport,
  summarizeAcrossReports,
  summarizeReport,
  SlugVulnReport,
} from "@/lib/osv";
import { VulnDashboard, VulnRow } from "@/components/VulnDashboard";

export const dynamic = "force-dynamic"; // npm run osv keeps appending files in the background

export default async function VulnerabilitiesIndexPage() {
  const slugs = await listVulnSlugs();
  const db = await loadVulnDb();
  const index = buildVulnIndex(db);
  const projectMap = new Map(allProjects.map((p) => [p.slug, p]));

  const reports: SlugVulnReport[] = [];
  const rows: VulnRow[] = await Promise.all(
    slugs.map(async (slug) => {
      const report = await readSlugReport(slug);
      if (report) reports.push(report);
      const summary = report ? summarizeReport(slug, report, db, index) : null;
      return { slug, project: projectMap.get(slug), summary };
    })
  );

  const globalStats = summarizeAcrossReports(reports, db, index);

  const lastScanned = rows.reduce<string | undefined>((latest, r) => {
    if (!r.summary?.scannedAt) return latest;
    return !latest || r.summary.scannedAt > latest ? r.summary.scannedAt : latest;
  }, undefined);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="py-16 text-center text-sm text-muted">
          아직 스캔 결과가 없습니다. <code className="font-mono">npm run osv</code>를
          먼저 실행하세요.
        </p>
      </div>
    );
  }

  return <VulnDashboard rows={rows} lastScanned={lastScanned} globalStats={globalStats} />;
}
