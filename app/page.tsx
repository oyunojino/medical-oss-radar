import { categories } from "@/lib/projects";
import { fetchRepoStats, RepoResult } from "@/lib/github";
import { Dashboard, CategoryWithResults } from "@/components/Dashboard";

export const revalidate = 3600; // page-level ISR, matches the GitHub fetch cache window

export default async function Home() {
  const categoriesWithResults: CategoryWithResults[] = await Promise.all(
    categories.map(async (category) => {
      const items = await Promise.all(
        category.projects.map(async (project) => {
          let result: RepoResult;
          if (project.owner && project.repo) {
            result = await fetchRepoStats(project.owner, project.repo);
          } else {
            result = {
              ok: false,
              reason: "외부 호스팅 — GitHub 통계 없음",
            };
          }
          return { project, result };
        })
      );
      return {
        code: category.code,
        slug: category.slug,
        title: category.title,
        subtitle: category.subtitle,
        items,
      };
    })
  );

  const lastSynced = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  return (
    <Dashboard categories={categoriesWithResults} lastSynced={lastSynced} />
  );
}
