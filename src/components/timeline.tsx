import { timeline } from "@/lib/timeline";

export function Timeline() {
  return (
    <ol className="flex flex-col">
      {timeline.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-x-12 gap-y-4 border-t border-rule py-10 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-1.5">
            <span className="tnum text-[15px] text-ink-soft">
              {entry.start} – {entry.end}
            </span>
            <span className="t-caption uppercase tracking-[0.11em] text-spark">
              {entry.kind === "work" ? "Work" : "Education"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="t-h2xs text-ink">{entry.title}</h3>
            <p className="text-[15px] font-extralight text-muted">
              {entry.org} · {entry.location}
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {entry.points.map((point) => (
                <li
                  key={point}
                  className="measure border-l border-rule pl-5 text-[16px] leading-relaxed font-extralight text-ink-soft"
                >
                  {point}
                </li>
              ))}
            </ul>
            {entry.aside ? (
              <p className="measure mt-3 border-l-2 border-action pl-5 text-[14px] leading-relaxed font-extralight text-muted">
                <span className="t-caption uppercase tracking-[0.1em] text-spark">
                  About the setting.{" "}
                </span>
                {entry.aside}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
