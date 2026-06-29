import Link from "next/link";
import { notFound } from "next/navigation";
import { allProjects } from "@/lib/projects";
import { hasSpdx, readCdx, sortedComponents, summarize } from "@/lib/sbom";

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
        <Link href="/sbom" className="text-sm text-vital hover:underline">
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

        <div className="mt-2 flex gap-4 text-sm">
          <a
            href={`/sbom/${params.slug}/cdx`}
            className="text-vital hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            CycloneDX JSON 원본
          </a>
          {spdxAvailable && (
            <a
              href={`/sbom/${params.slug}/spdx`}
              className="text-vital hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              SPDX JSON 원본
            </a>
          )}
          <Link href={`/vulnerabilities/${params.slug}`} className="text-vital hover:underline">
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
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">버전</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">라이선스</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={`${c.name}-${i}`} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono text-ink">{c.name}</td>
                  <td className="px-3 py-1.5 text-muted">{c.version ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted">{c.type}</td>
                  <td className="px-3 py-1.5 text-muted">
                    {(c.licenses ?? [])
                      .map((l) => l.license?.id || l.license?.name)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
              {components.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted" colSpan={4}>
                    감지된 구성요소가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
