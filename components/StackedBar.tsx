export type BarSegment = {
  key: string;
  count: number;
  color: string;
  label?: string;
};

/** Generic horizontal proportion bar — segments are rendered in the given order,
 *  each sized to its share of the total. Used for severity mix, activity status
 *  mix, ecosystem mix, etc. */
export function StackedBar({
  segments,
  className = "",
}: {
  segments: BarSegment[];
  className?: string;
}) {
  const total = segments.reduce((n, s) => n + s.count, 0);

  if (total === 0) {
    return <div className={`rounded-full bg-line ${className}`} />;
  }

  return (
    <div className={`flex overflow-hidden rounded-full bg-line ${className}`}>
      {segments
        .filter((s) => s.count > 0)
        .map((s) => (
          <div
            key={s.key}
            title={`${s.label ?? s.key} ${s.count}`}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
          />
        ))}
    </div>
  );
}

/** Single-color proportional bar for ranked lists (e.g. "top 10 by X"). */
export function RankBar({
  value,
  max,
  color = "#0F9D8C",
  className = "",
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0;
  return (
    <div className={`overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
