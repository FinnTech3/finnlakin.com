import { timeline } from "@/lib/timeline";

export function Timeline() {
  return (
    <ol className="flex flex-col">
      {timeline.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-x-8 gap-y-3 border-t border-rule py-7 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs tabular-nums text-muted">
              {entry.start} – {entry.end}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.11em] text-muted">
              {entry.kind === "work" ? "Work" : "Education"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-base font-medium">{entry.title}</h3>
            <p className="text-sm text-muted">
              {entry.org} · {entry.location}
            </p>
            <ul className="mt-1 flex flex-col gap-2">
              {entry.points.map((point) => (
                <li
                  key={point}
                  className="max-w-[64ch] border-l border-rule pl-4 text-sm leading-relaxed text-ink-soft"
                >
                  {point}
                </li>
              ))}
            </ul>
            {entry.aside ? (
              <p className="mt-2 max-w-[64ch] bg-accent-soft px-4 py-3 text-xs leading-relaxed text-muted">
                <span className="font-mono uppercase tracking-[0.1em]">
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
