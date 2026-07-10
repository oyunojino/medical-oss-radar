import { KevEntry } from "@/lib/severity";
import { VexEntry } from "@/lib/vex";

/** VEX pilot status pill for one (component, canonical vuln) pair. Renders
 *  nothing when `entry` is undefined — that means either this repo was never
 *  in the pilot's top-N, or this specific pair was never eligible (wrong
 *  ecosystem, no fix-commit data) — silence is intentional, not an omission,
 *  see the plan this pilot was built against.
 *
 *  No "use client" needed — <details>/<summary> needs no JS, so this renders
 *  fine from both server components (the vuln-list cards) and client
 *  components (VulnAffectedTable's paginated rows). */
export function VexPill({ entry }: { entry: VexEntry | undefined }) {
  if (!entry) return null;

  if (entry.status === "not_affected") {
    return (
      <details className="inline-block align-middle">
        <summary className="inline-block cursor-pointer list-none rounded-full border border-vital/50 bg-vital-soft px-2 py-0.5 font-mono text-[0.7rem] text-vital">
          VEX: 영향 없음
        </summary>
        <div className="mt-1 max-w-xs rounded-md border border-line bg-panel p-2 text-[0.7rem] text-muted">
          <p>
            근거: 취약 함수가 실제 배포 버전 소스에 없음 (
            {entry.evidence.functionNamesChecked.join(", ") || "함수명 없음"})
          </p>
          {entry.evidence.fixCommits[0] && (
            <a
              href={entry.evidence.fixCommits[0].url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-vital hover:underline"
            >
              fix 커밋 보기 →
            </a>
          )}
          <p className="mt-1">
            검색한 파일 {entry.evidence.filesSearched}건
            {entry.evidence.filesSkippedMinified > 0 &&
              ` (minified/bundled ${entry.evidence.filesSkippedMinified}건 제외)`}
          </p>
        </div>
      </details>
    );
  }

  return (
    <span
      title={entry.evidence.reason ?? undefined}
      className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.7rem] text-muted"
    >
      VEX: 조사 중
    </span>
  );
}

/** CISA KEV badge — renders nothing when `entry` is undefined (this CVE isn't
 *  in the catalog, or vulns/_kev.json hasn't been generated yet via `npm run
 *  kev`). Presence in KEV is a binary fact from an authoritative government
 *  source, so unlike VexPill there's no "ambiguous" state to represent. */
export function KevPill({ entry }: { entry: KevEntry | undefined }) {
  if (!entry) return null;

  const ransomware = entry.knownRansomwareCampaignUse === "Known" ? "확인됨" : "미확인";

  return (
    <span
      title={`${entry.vulnerabilityName}\n등재일 ${entry.dateAdded} · 조치 기한 ${entry.dueDate}\n랜섬웨어 악용: ${ransomware}`}
      className="rounded-full bg-coral px-2 py-0.5 font-mono text-[0.7rem] text-paper"
    >
      ⚠ KEV
    </span>
  );
}
