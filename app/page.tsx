import { categories } from "@/lib/projects";
import { fetchAllRepoStats, RepoResult } from "@/lib/github";
import { Dashboard, CategoryWithResults } from "@/components/Dashboard";

export const revalidate = 3600; // page-level ISR, matches the GitHub fetch cache window

export default async function Home() {
  const repos = categories
    .flatMap((c) => c.projects)
    .filter((p): p is typeof p & { owner: string; repo: string } => Boolean(p.owner && p.repo))
    .map((p) => ({ owner: p.owner, repo: p.repo }));
  const statsByRepo = await fetchAllRepoStats(repos);

  const categoriesWithResults: CategoryWithResults[] = categories.map((category) => {
    const items = category.projects.map((project) => {
      let result: RepoResult;
      if (project.owner && project.repo) {
        result = statsByRepo.get(`${project.owner}/${project.repo}`) ?? {
          ok: false,
          reason: "GitHub API 오류",
        };
      } else {
        result = {
          ok: false,
          reason: "외부 호스팅 — GitHub 통계 없음",
        };
      }
      return { project, result };
    });
    return {
      code: category.code,
      slug: category.slug,
      title: category.title,
      subtitle: category.subtitle,
      items,
    };
  });

  const lastSynced = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  return (
    <Dashboard categories={categoriesWithResults} lastSynced={lastSynced} />
  );
}
