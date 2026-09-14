/* Two chart forms, both plain HTML and CSS. No chart library, and no d3
   either: these shapes need arithmetic, not a scale factory, and a dependency
   that earns nothing is still a dependency. Everything renders on the server,
   so a page with no chart on it ships no chart code. Labels are real text
   rather than SVG <text>, which keeps them at their intended size instead of
   scaling with the drawing at phone width. */

export function IntervalBand({
  caption,
  widthLabel,
  low,
  high,
  point,
  reading,
}: {
  caption: string;
  widthLabel: string;
  low: { value: string; note: string };
  high: { value: string; note: string };
  /* An optional marker inside the band. `at` is a percentage of the way from
     low to high, so the caller does the arithmetic against real values rather
     than this component guessing a scale it cannot see. */
  point?: { value: string; note: string; at: number };
  reading?: string;
}) {
  const at = point ? Math.min(Math.max(point.at, 0), 100) : 0;
  return (
    <figure className="m-0 flex flex-col gap-3 border border-rule bg-panel p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
          {caption}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent">
          {widthLabel}
        </span>
      </figcaption>

      <div aria-hidden="true" className="relative mx-2 my-3 h-5">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
        <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 border-x-2 border-accent bg-accent-soft" />
        <span className="absolute left-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-ink" />
        <span className="absolute right-0 top-1/2 size-3 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-ink" />
        {point ? (
          <span
            className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-accent"
            style={{ left: `${at}%` }}
          />
        ) : null}
      </div>

      {point ? (
        <p
          className="-mt-1 flex flex-col text-[11px] leading-snug text-muted"
          style={{ marginLeft: `min(${at}%, calc(100% - 9rem))` }}
        >
          <span className="font-mono text-[13px] font-medium tabular-nums text-accent">
            {point.value}
          </span>
          {point.note}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-[15px] font-medium tabular-nums">{low.value}</span>
          <span className="text-[11px] leading-snug text-muted">{low.note}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="font-mono text-[15px] font-medium tabular-nums">{high.value}</span>
          <span className="text-[11px] leading-snug text-muted">{high.note}</span>
        </div>
      </div>

      {reading ? (
        <p className="max-w-[58ch] border-t border-rule pt-3 text-[13px] leading-relaxed text-muted">
          {reading}
        </p>
      ) : null}
    </figure>
  );
}

export function ProportionBar({
  caption,
  total,
  parts,
  reading,
}: {
  caption: string;
  total: number;
  parts: { label: string; value: number; tone: "flag" | "neutral" }[];
  reading?: string;
}) {
  return (
    <figure className="m-0 flex flex-col gap-3 border border-rule bg-panel p-5">
      <figcaption className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
        {caption}
      </figcaption>

      <div aria-hidden="true" className="flex h-4 w-full overflow-hidden bg-rule">
        {parts.map((part) => (
          <div
            key={part.label}
            className={part.tone === "flag" ? "bg-flag" : "bg-rule-strong"}
            style={{ width: `${Math.max((part.value / total) * 100, 0.6)}%` }}
          />
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {parts.map((part) => (
          <div key={part.label} className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 ${part.tone === "flag" ? "bg-flag" : "bg-rule-strong"}`}
            />
            <dt className="text-[12px] text-muted">{part.label}</dt>
            <dd
              className={`font-mono text-[13px] font-medium tabular-nums ${
                part.tone === "flag" ? "text-flag" : "text-ink"
              }`}
            >
              {part.value.toLocaleString("en-GB")}
            </dd>
          </div>
        ))}
      </dl>

      {reading ? (
        <p className="max-w-[58ch] border-t border-rule pt-3 text-[13px] leading-relaxed text-muted">
          {reading}
        </p>
      ) : null}
    </figure>
  );
}
