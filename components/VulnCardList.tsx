"use client";

import { useMemo, useState } from "react";
import { KevEntry, SeverityLevel, SEVERITY_ORDER } from "@/lib/severity";
import { KevPill } from "./VulnPills";

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  CRITICAL: "border-coral bg-coral-soft text-coral",
  HIGH: "border-coral/60 bg-coral-soft text-coral",
  MEDIUM: "border-amber bg-amber-soft text-amber",
  LOW: "border-vital/60 bg-vital-soft text-vital",
  UNKNOWN: "border-line bg-panel text-muted",
};

export type VexAggregateStatus = "not_affected" | "under_investigation" | "unreviewed";

const VEX_STATUS_LABEL: Record<VexAggregateStatus, string> = {
  not_affected: "VEX: 영향없음",
  under_investigation: "VEX: 조사중",
  unreviewed: "VEX 미검토",
};

export type VulnCardData = {
  canonicalId: string;
  displayId: string;
  severity: SeverityLevel;
  kev?: KevEntry;
  aliases: string[];
  summary: string;
  affectedNames: string[];
  vexStatus: VexAggregateStatus;
};

type SeverityFilter = "ALL" | "KEV" | SeverityLevel;
type VexFilter = "ALL" | VexAggregateStatus;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-vital bg-vital-soft px-3 py-1 font-mono text-xs text-vital"
          : "rounded-full border border-line px-3 py-1 font-mono text-xs text-muted transition hover:border-vital/50 hover:text-ink"
      }
    >
      {children}
    </button>
  );
}

export function VulnCardList({ items }: { items: VulnCardData[] }) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [vexFilter, setVexFilter] = useState<VexFilter>("ALL");

  const severityCounts = useMemo(() => {
    const counts: Partial<Record<SeverityLevel, number>> = {};
    let kevCount = 0;
    for (const item of items) {
      counts[item.severity] = (counts[item.severity] ?? 0) + 1;
      if (item.kev) kevCount++;
    }
    return { counts, kevCount };
  }, [items]);

  const vexCounts = useMemo(() => {
    const counts: Record<VexAggregateStatus, number> = {
      not_affected: 0,
      under_investigation: 0,
      unreviewed: 0,
    };
    for (const item of items) counts[item.vexStatus]++;
    return counts;
  }, [items]);

  const filtered = items.filter((item) => {
    const severityOk =
      severityFilter === "ALL" ||
      (severityFilter === "KEV" ? Boolean(item.kev) : item.severity === severityFilter);
    const vexOk = vexFilter === "ALL" || item.vexStatus === vexFilter;
    return severityOk && vexOk;
  });

  const hasVexData = vexCounts.not_affected + vexCounts.under_investigation > 0;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={severityFilter === "ALL"} onClick={() => setSeverityFilter("ALL")}>
            전체 {items.length}
          </FilterChip>
          {SEVERITY_ORDER.filter((level) => severityCounts.counts[level]).map((level) => (
            <FilterChip
              key={level}
              active={severityFilter === level}
              onClick={() => setSeverityFilter(level)}
            >
              {level} {severityCounts.counts[level]}
            </FilterChip>
          ))}
          {severityCounts.kevCount > 0 && (
            <FilterChip active={severityFilter === "KEV"} onClick={() => setSeverityFilter("KEV")}>
              KEV {severityCounts.kevCount}
            </FilterChip>
          )}
        </div>

        {hasVexData && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={vexFilter === "ALL"} onClick={() => setVexFilter("ALL")}>
              전체
            </FilterChip>
            {(["not_affected", "under_investigation", "unreviewed"] as VexAggregateStatus[])
              .filter((status) => vexCounts[status] > 0)
              .map((status) => (
                <FilterChip
                  key={status}
                  active={vexFilter === status}
                  onClick={() => setVexFilter(status)}
                >
                  {VEX_STATUS_LABEL[status]} {vexCounts[status]}
                </FilterChip>
              ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">조건에 맞는 취약점이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <div key={item.canonicalId} className="rounded-md border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://osv.dev/vulnerability/${item.displayId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-vital hover:underline"
                >
                  {item.displayId}
                </a>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[0.7rem] ${SEVERITY_BADGE[item.severity]}`}
                >
                  {item.severity}
                </span>
                <KevPill entry={item.kev} />
                {item.aliases.slice(0, 3).map((alias) => (
                  <span
                    key={alias}
                    className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.7rem] text-muted"
                  >
                    {alias}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-ink">{item.summary}</p>
              <p className="mt-2 text-xs text-muted">
                영향받는 구성요소: {item.affectedNames.join(", ")}
              </p>
              {item.vexStatus !== "unreviewed" && (
                <p className="mt-1 text-xs text-muted">
                  {VEX_STATUS_LABEL[item.vexStatus]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
