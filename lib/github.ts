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

const GRAPHQL_BATCH_SIZE = 50; // repos per GraphQL request — keeps query cost well
// under GitHub's per-call complexity ceiling while cutting 200+ REST calls to ~5.

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** 403 with a Retry-After header is GitHub's secondary/abuse rate limit (too many
 *  concurrent or rapid requests); 429 is the same idea on some endpoints. Both are
 *  distinct from the primary hourly quota and just mean "back off a bit". */
function rateLimitReason(res: Response): string {
  const retryAfter = res.headers.get("retry-after");
  return retryAfter
    ? `GitHub API 요청 급증으로 제한됨 — ${retryAfter}초 후 재시도`
    : "GitHub API 호출 한도 초과 — GITHUB_TOKEN 설정 권장";
}

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

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
    if (res.status === 429 || res.status === 403) {
      return { ok: false, reason: rateLimitReason(res) };
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

/** Batched fetch for pages that need many repos at once (the dashboard lists 200+).
 *  When GITHUB_TOKEN is set, this uses a handful of GraphQL requests (GitHub's
 *  GraphQL API always requires auth) instead of one REST call per repo — that
 *  avoids both the 60/hour unauthenticated ceiling and the secondary rate limit
 *  that firing 200+ concurrent REST calls tends to trigger. Without a token it
 *  falls back to REST with bounded concurrency, which is still rate-limited but
 *  at least fails predictably instead of stampeding GitHub. */
export async function fetchAllRepoStats(
  repos: { owner: string; repo: string }[]
): Promise<Map<string, RepoResult>> {
  const results = new Map<string, RepoResult>();
  if (repos.length === 0) return results;

  if (process.env.GITHUB_TOKEN) {
    await fetchViaGraphQL(repos, results);
  } else {
    await fetchViaRestLimited(repos, results);
  }
  return results;
}

async function fetchViaGraphQL(
  repos: { owner: string; repo: string }[],
  results: Map<string, RepoResult>
): Promise<void> {
  for (const batch of chunk(repos, GRAPHQL_BATCH_SIZE)) {
    const fields = batch
      .map(
        (r, i) => `r${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.repo)}) {
          stargazerCount
          issues(states: OPEN) { totalCount }
          primaryLanguage { name }
          licenseInfo { spdxId }
          pushedAt
          isArchived
          url
        }`
      )
      .join("\n");

    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: `query { ${fields} }` }),
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (res.status === 429 || res.status === 403) {
        const reason = rateLimitReason(res);
        for (const r of batch) results.set(repoKey(r.owner, r.repo), { ok: false, reason });
        continue;
      }
      if (!res.ok) {
        const reason = `GitHub GraphQL API 오류 (${res.status})`;
        for (const r of batch) results.set(repoKey(r.owner, r.repo), { ok: false, reason });
        continue;
      }

      const body = await res.json();
      const errorsByAlias = new Map<string, string>();
      for (const err of body.errors ?? []) {
        const alias = err.path?.[0];
        if (typeof alias === "string") errorsByAlias.set(alias, err.message ?? "GraphQL 오류");
      }

      batch.forEach((r, i) => {
        const alias = `r${i}`;
        const node = body.data?.[alias];
        if (!node) {
          results.set(repoKey(r.owner, r.repo), {
            ok: false,
            reason:
              errorsByAlias.get(alias) ?? "저장소를 찾을 수 없음 (이름이 바뀌었거나 슬러그 오류)",
          });
          return;
        }
        results.set(repoKey(r.owner, r.repo), {
          ok: true,
          stats: {
            stars: node.stargazerCount ?? 0,
            openIssues: node.issues?.totalCount ?? 0,
            language: node.primaryLanguage?.name ?? null,
            license: node.licenseInfo?.spdxId ?? null,
            pushedAt: node.pushedAt,
            archived: Boolean(node.isArchived),
            htmlUrl: node.url ?? `https://github.com/${r.owner}/${r.repo}`,
          },
        });
      });
    } catch {
      const reason = "네트워크 오류로 데이터를 가져오지 못함";
      for (const r of batch) results.set(repoKey(r.owner, r.repo), { ok: false, reason });
    }
  }
}

async function fetchViaRestLimited(
  repos: { owner: string; repo: string }[],
  results: Map<string, RepoResult>,
  concurrency = 5
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < repos.length) {
      const i = index++;
      const r = repos[i];
      results.set(repoKey(r.owner, r.repo), await fetchRepoStats(r.owner, r.repo));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, repos.length) }, worker));
}
