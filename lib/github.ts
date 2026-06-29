export type RepoStats = {
  stars: number;
  openIssues: number;
  language: string | null;
  license: string | null;
  pushedAt: string;
  archived: boolean;
  htmlUrl: string;
};

export type RepoResult =
  | { ok: true; stats: RepoStats }
  | { ok: false; reason: string };

const REVALIDATE_SECONDS = 60 * 60; // refresh once an hour — keeps the dashboard
// "continuously" current without burning through GitHub's rate limit on every visit.

export async function fetchRepoStats(owner: string, repo: string): Promise<RepoResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };

  // Optional: set GITHUB_TOKEN in .env.local to raise the rate limit from
  // 60 req/hour (unauthenticated) to 5,000 req/hour.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (res.status === 404) {
      return { ok: false, reason: "저장소를 찾을 수 없음 (이름이 바뀌었거나 슬러그 오류)" };
    }
    if (res.status === 403) {
      return { ok: false, reason: "GitHub API 호출 한도 초과 — GITHUB_TOKEN 설정 권장" };
    }
    if (!res.ok) {
      return { ok: false, reason: `GitHub API 오류 (${res.status})` };
    }

    const data = await res.json();
    return {
      ok: true,
      stats: {
        stars: data.stargazers_count ?? 0,
        openIssues: data.open_issues_count ?? 0,
        language: data.language ?? null,
        license: data.license?.spdx_id ?? null,
        pushedAt: data.pushed_at,
        archived: Boolean(data.archived),
        htmlUrl: data.html_url ?? `https://github.com/${owner}/${repo}`,
      },
    };
  } catch (err) {
    return { ok: false, reason: "네트워크 오류로 데이터를 가져오지 못함" };
  }
}
