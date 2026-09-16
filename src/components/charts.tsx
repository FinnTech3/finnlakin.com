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
    <figure className="m-0 flex flex-col gap-4 border-y border-rule py-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="t-caption uppercase tracking-[0.12em] text-muted">{caption}</span>
        <span className="t-caption uppercase tracking-[0.12em] text-spark">{widthLabel}</span>
      </figcaption>

      <div aria-hidden="true" className="relative mx-2 my-3 h-5">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
        <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 border-x-2 border-action bg-action-soft" />
        <span className="absolute left-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-ink" />
        <span className="absolute right-0 top-1/2 size-3 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-ink" />
        {point ? (
          <span
            className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-spark"
            style={{ left: `${at}%` }}
          />
        ) : null}
      </div>

      {point ? (
        <p
          className="-mt-1 flex flex-col text-[13px] leading-snug font-extralight text-muted"
          style={{ marginLeft: `min(${at}%, calc(100% - 9rem))` }}
        >
          <span className="tnum text-[15px] text-spark">
            {point.value}
          </span>
          {point.note}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="tnum text-[17px] text-ink">{low.value}</span>
          <span className="text-[13px] leading-snug font-extralight text-muted">{low.note}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="tnum text-[17px] text-ink">{high.value}</span>
          <span className="text-[13px] leading-snug font-extralight text-muted">{high.note}</span>
        </div>
      </div>

      {reading ? (
        <p className="max-w-[58ch] border-t border-rule pt-4 text-[14px] leading-relaxed font-extralight text-muted">
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
    <figure className="m-0 flex flex-col gap-4 border-y border-rule py-6">
      <figcaption className="t-caption uppercase tracking-[0.12em] text-muted">{caption}</figcaption>

      <div aria-hidden="true" className="flex h-5 w-full overflow-hidden bg-rule">
        {parts.map((part) => (
          <div
            key={part.label}
            className={part.tone === "flag" ? "bg-flag" : "bg-action"}
            style={{ width: `${Math.max((part.value / total) * 100, 0.6)}%` }}
          />
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {parts.map((part) => (
          <div key={part.label} className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 ${part.tone === "flag" ? "bg-flag" : "bg-action"}`}
            />
            <dt className="text-[14px] font-extralight text-muted">{part.label}</dt>
            <dd
              className={`tnum text-[15px] ${part.tone === "flag" ? "text-flag" : "text-ink"}`}
            >
              {part.value.toLocaleString("en-GB")}
            </dd>
          </div>
        ))}
      </dl>

      {reading ? (
        <p className="max-w-[58ch] border-t border-rule pt-4 text-[14px] leading-relaxed font-extralight text-muted">
          {reading}
        </p>
      ) : null}
    </figure>
  );
}
