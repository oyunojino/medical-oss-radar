"use client";

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-3 font-mono text-xs text-muted">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-line px-3 py-1 transition hover:border-vital/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        ◁ 이전
      </button>
      <span>
        {page}/{pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md border border-line px-3 py-1 transition hover:border-vital/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음 ▷
      </button>
    </div>
  );
}
