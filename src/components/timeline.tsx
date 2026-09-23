import { timeline } from "@/lib/timeline";

/* The heading level is a prop because this renders under two different
   ancestors. On a page whose own title is an h1 these entries are h2; inside a
   section of the home page, where the section's title is the h2, they are h3.
   Hardcoded at h3 it shipped an h1 followed by an h3 on /path, which axe
   reports as a skipped level and a screen reader reports as a missing
   section. */
export function Timeline({ level = 3 }: { level?: 2 | 3 } = {}) {
  const Heading = level === 2 ? "h2" : "h3";
  return timelineList(Heading);
}

function timelineList(Heading: "h2" | "h3") {
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
            <span className="t-label">
              {entry.kind === "work" ? "Work" : "Education"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Heading className="t-h3 text-ink">{entry.title}</Heading>
            <p className="text-[15px] text-muted">
              {entry.org} · {entry.location}
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {entry.points.map((point) => (
                <li
                  key={point}
                  className="measure border-l border-rule pl-5 text-[16px] leading-relaxed text-ink-soft"
                >
                  {point}
                </li>
              ))}
            </ul>
            {entry.aside ? (
              <p className="measure mt-3 border-l-2 border-action pl-5 text-[14px] leading-relaxed text-muted">
                <span className="t-label">
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
