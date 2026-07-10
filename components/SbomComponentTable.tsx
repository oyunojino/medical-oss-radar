"use client";

import { useEffect, useMemo, useState } from "react";
import type { CdxComponent } from "@/lib/sbom";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 50;

function licenseOf(c: CdxComponent): string {
  return (
    (c.licenses ?? [])
      .map((l) => l.license?.id || l.license?.name)
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function matches(c: CdxComponent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) || licenseOf(c).toLowerCase().includes(q)
  );
}

export function SbomComponentTable({ components }: { components: CdxComponent[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => components.filter((c) => matches(c, query)),
    [components, query]
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
          placeholder="이름 또는 라이선스로 검색"
          className="w-full max-w-xs rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-vital/40"
        />
        <p className="shrink-0 font-mono text-xs text-muted">
          {filtered.length}/{components.length}
        </p>
      </div>

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
            {pageItems.map((c, i) => (
              <tr key={`${c.name}-${i}`} className="border-t border-line">
                <td className="px-3 py-1.5 font-mono text-ink">{c.name}</td>
                <td className="px-3 py-1.5 text-muted">{c.version ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted">{c.type}</td>
                <td className="px-3 py-1.5 text-muted">{licenseOf(c)}</td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted" colSpan={4}>
                  {components.length === 0
                    ? "감지된 구성요소가 없습니다."
                    : "검색 결과가 없습니다."}
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
