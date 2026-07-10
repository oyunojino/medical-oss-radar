"use client";

import { Fragment, useState } from "react";

/** Renders `items` in a grid, capped at `initialCount` until the user clicks
 *  "더보기" — or immediately in full when `forceExpand` is true (e.g. an
 *  active search query already narrowed the list, so a further cap would just
 *  hide matches). Keeps each section's collapsed length predictable as the
 *  underlying data grows, without needing real pagination/virtualization. */
export function ExpandableGrid<T>({
  items,
  initialCount,
  forceExpand = false,
  renderItem,
  keyOf,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  items: T[];
  initialCount: number;
  forceExpand?: boolean;
  renderItem: (item: T) => React.ReactNode;
  keyOf: (item: T) => string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || forceExpand;
  const visible = showAll ? items : items.slice(0, initialCount);
  const remaining = items.length - visible.length;

  return (
    <>
      <div className={className}>
        {visible.map((item) => (
          <Fragment key={keyOf(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      {!showAll && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full rounded-md border border-line bg-panel py-2 text-center font-mono text-xs text-muted transition hover:border-vital/50 hover:text-ink"
        >
          더보기 ({remaining}개 남음) ▾
        </button>
      )}
    </>
  );
}
