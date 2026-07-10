import Link from "next/link";
import { notFound } from "next/navigation";
import { allProjects } from "@/lib/projects";
import { hasSpdx, readCdx, sortedComponents, summarize } from "@/lib/sbom";
import { SbomComponentTable } from "@/components/SbomComponentTable";

export const dynamic = "force-dynamic";

export default async function SbomDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const cdx = await readCdx(params.slug);
  if (!cdx) notFound();

  const summary = summarize(params.slug, cdx);
  const components = sortedComponents(cdx);
  const spdxAvailable = await hasSpdx(params.slug);
  const project = allProjects.find((p) => p.slug === params.slug);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-2 border-b border-line pb-6">
        <Link
          href="/sbom"
          className="self-start rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink transition hover:border-vital/50 hover:text-vital"
        >
          ← SBOM 목록으로
        </Link>
        <p className="font-mono text-xs tracking-tagcode text-vital">
          {project?.categoryCode ?? "SBOM"}
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
        {project?.description && (
          <p className="text-sm text-muted">{project.description}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
          <span>구성요소 {summary.componentCount}</span>
          <span>고유 라이선스 {summary.licenseCount}</span>
          <span>CycloneDX {summary.specVersion ?? "?"}</span>
          {summary.generatedAt && (
            <span>생성 {new Date(summary.generatedAt).toLocaleString("ko-KR")}</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`/sbom/${params.slug}/cdx`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink transition hover:border-vital/50 hover:text-vital"
          >
            CycloneDX JSON 원본
          </a>
          {spdxAvailable && (
            <a
              href={`/sbom/${params.slug}/spdx`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink transition hover:border-vital/50 hover:text-vital"
            >
              SPDX JSON 원본
            </a>
          )}
          <Link
            href={`/vulnerabilities/${params.slug}`}
            className="rounded-md border border-vital/50 bg-vital-soft px-3 py-1.5 font-mono text-xs text-vital transition hover:border-vital"
          >
            취약점 스캔 보기 →
          </Link>
        </div>
      </header>

      {summary.ecosystems.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            패키지 생태계 분포
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.ecosystems.map((e) => (
              <span
                key={e.name}
                className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-xs text-muted"
              >
                {e.name} · {e.count}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">
          구성요소 ({components.length})
        </h2>
        <SbomComponentTable components={components} />
      </section>
    </div>
  );
}
