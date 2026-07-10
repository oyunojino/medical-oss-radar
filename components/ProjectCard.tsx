import { Project } from "@/lib/projects";
import { RepoResult } from "@/lib/github";
import { timeAgoKo, vitalStatus } from "@/lib/time";
import { Pulse } from "./Pulse";

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const MAX_VISIBLE_TAGS = 4;

export function ProjectCard({
  project,
  result,
}: {
  project: Project;
  result: RepoResult | null;
}) {
  const repoUrl =
    project.owner && project.repo
      ? `https://github.com/${project.owner}/${project.repo}`
      : project.websiteUrl ?? "#";

  return (
    <a
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-md border border-line bg-panel p-4 transition-colors hover:border-vital/50 hover:bg-vital-soft/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-[0.95rem] font-medium text-ink">
          {project.name}
        </h3>
        <div className="flex items-center gap-2">
          {project.verified && (
            <span
              title="DPG Registry에서 출처 확인됨"
              className="rounded-sm bg-vital-soft px-1.5 py-0.5 font-mono text-[0.6rem] tracking-tagcode text-vital"
            >
              ✓ VERIFIED
            </span>
          )}
          <span className="font-mono text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
            ↗
          </span>
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-snug text-muted">
        {project.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {project.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
          <span
            key={tag}
            className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.65rem] tracking-tagcode text-muted"
          >
            {tag.toUpperCase()}
          </span>
        ))}
        {project.tags.length > MAX_VISIBLE_TAGS && (
          <span className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.65rem] tracking-tagcode text-muted/70">
            +{project.tags.length - MAX_VISIBLE_TAGS}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-dashed border-line pt-3">
        {result && result.ok ? (
          <>
            <div className="flex items-center gap-3 font-mono text-xs text-muted">
              <span title="Stars">★ {formatStars(result.stats.stars)}</span>
              <span title="마지막 커밋">
                {timeAgoKo(result.stats.pushedAt)}
              </span>
            </div>
            <Pulse
              status={vitalStatus(
                Math.floor(
                  (Date.now() - new Date(result.stats.pushedAt).getTime()) /
                    86400000
                ),
                result.stats.archived
              )}
            />
          </>
        ) : (
          <span className="font-mono text-xs text-muted/70">
            {result && !result.ok ? result.reason : "데이터 불러오는 중…"}
          </span>
        )}
      </div>
    </a>
  );
}
