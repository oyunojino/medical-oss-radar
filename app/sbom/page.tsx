import { allProjects } from "@/lib/projects";
import { listSbomSlugs, readCdx, summarize } from "@/lib/sbom";
import { SbomDashboard, SbomRow } from "@/components/SbomDashboard";

export const dynamic = "force-dynamic"; // npm run sbom keeps appending files in the background

export default async function SbomIndexPage() {
  const slugs = await listSbomSlugs();
  const projectMap = new Map(allProjects.map((p) => [p.slug, p]));

  const rows: SbomRow[] = await Promise.all(
    slugs.map(async (slug) => {
      const cdx = await readCdx(slug);
      return {
        slug,
        project: projectMap.get(slug),
        summary: cdx ? summarize(slug, cdx) : null,
      };
    })
  );

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="py-16 text-center text-sm text-muted">
          아직 생성된 SBOM이 없습니다. <code className="font-mono">npm run sbom</code>을
          먼저 실행하세요.
        </p>
      </div>
    );
  }

  return <SbomDashboard rows={rows} />;
}
