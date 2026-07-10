export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-3">
      <p className="truncate font-mono text-[0.65rem] tracking-tagcode text-muted" title={label}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${accent ?? "text-ink"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
