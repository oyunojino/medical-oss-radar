"use client";

import { useState } from "react";
import { AffectedRow, VulnAffectedTable } from "./VulnAffectedTable";
import { VulnCardData, VulnCardList } from "./VulnCardList";

type Tab = "vulns" | "affected";

export function VulnTabs({
  vulnCards,
  affectedRows,
}: {
  vulnCards: VulnCardData[];
  affectedRows: AffectedRow[];
}) {
  const [tab, setTab] = useState<Tab>("vulns");

  const tabClass = (active: boolean) =>
    active
      ? "border-b-2 border-vital px-1 pb-2 text-sm font-semibold text-ink"
      : "border-b-2 border-transparent px-1 pb-2 text-sm text-muted transition hover:text-ink";

  return (
    <div>
      <div className="mb-4 flex gap-6 border-b border-line">
        <button type="button" onClick={() => setTab("vulns")} className={tabClass(tab === "vulns")}>
          취약점 ({vulnCards.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("affected")}
          className={tabClass(tab === "affected")}
        >
          영향받는 구성요소 ({affectedRows.length})
        </button>
      </div>

      {tab === "vulns" ? (
        <VulnCardList items={vulnCards} />
      ) : (
        <VulnAffectedTable rows={affectedRows} />
      )}
    </div>
  );
}
