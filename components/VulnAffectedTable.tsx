"use client";

import { useEffect, useMemo, useState } from "react";
import { SeverityLevel } from "@/lib/severity";
import type { KevEntry } from "@/lib/severity";
import type { VexEntry } from "@/lib/vex";
import { Pagination } from "./Pagination";
import { VexPill, KevPill } from "./VulnPills";

const PAGE_SIZE = 50;

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  CRITICAL: "border-coral bg-coral-soft text-coral",
  HIGH: "border-coral/60 bg-coral-soft text-coral",
  MEDIUM: "border-amber bg-amber-soft text-amber",
  LOW: "border-vital/60 bg-vital-soft text-vital",
  UNKNOWN: "border-line bg-panel text-muted",
};

export type AffectedVulnBadge = {
  canonicalId: string;
  displayId: string;
  severity: SeverityLevel;
  kev?: KevEntry;
  vex?: VexEntry;
};

export type AffectedRow = {
  name: string;
  version?: string;
  purl: string;
  vulns: AffectedVulnBadge[];
};

function matches(row: AffectedRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.name.toLowerCase().includes(q);
}

/** Client-side search + pagination over a project's affected-component table.
 * `rows` must already be resolved to plain data server-side (lib/osv.ts's
 * `VulnIndex` holds closures over Maps, which can't cross the server->client
 * component boundary as props). */
export function VulnAffectedTable({ rows }: { rows: AffectedRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => rows.filter((r) => matches(r, query)),
    [rows, query]
  );

  useEffect(() => setPage(1), [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="구성요소 이름으로 검색"
          className="w-full max-w-xs rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-vital/40"
        />
        <p className="shrink-0 font-mono text-xs text-muted">
          {filtered.length}/{rows.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">버전</th>
              <th className="px-3 py-2">취약점</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <tr key={c.purl} className="border-t border-line">
                <td className="px-3 py-1.5 font-mono text-ink">{c.name}</td>
                <td className="px-3 py-1.5 text-muted">{c.version ?? "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {c.vulns.map((v) => (
                      <span key={v.canonicalId} className="inline-flex items-center gap-1">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[0.7rem] ${SEVERITY_BADGE[v.severity]}`}
                        >
                          {v.displayId}
                        </span>
                        <VexPill entry={v.vex} />
                        <KevPill entry={v.kev} />
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted" colSpan={3}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}
