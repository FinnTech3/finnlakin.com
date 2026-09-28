/* A figure drawn from numbers that are already on the page.

   Every picture on this site has to be one of two things: a reconstruction of a
   published figure, or a drawing of a number this site can source. This is the
   second. It takes values that appear as text in projects.ts, with their unit,
   and draws them against a common axis, which is the one thing a list of
   statistics cannot do: show that one of them is thirty one times another.

   Plain SVG and plain arithmetic, like charts.tsx beside it. No chart library,
   because a scale factory and a layout engine are a great deal of bytes to
   compute max() and a percentage, and this renders on the server so a page
   without a figure ships none of it.

   The drawing is aria-hidden and the caption carries the comparison in words.
   A bar chart read out as a list of paths is worse than useless, and the
   numbers themselves are already in the statistics list beside it. */
export type CompareRow = {
  label: string;
  value: number;
  /* What to print, where the printed form is not just the number: "0", "14 bp",
     "byte-identical". Never derived, because rounding a sourced figure for a
     label is how a figure stops matching its own text. */
  display: string;
  note?: string;
  tone?: "pass" | "flag";
};

export function CompareFigure({
  caption,
  axisLabel,
  rows,
  reading,
}: {
  caption: string;
  axisLabel: string;
  rows: CompareRow[];
  reading: string;
}) {
  const largest = Math.max(...rows.map((row) => row.value), 0);

  return (
    <figure className="m-0 flex flex-col gap-5 rounded-[--radius-card] bg-card px-6 py-7 sm:px-9 sm:py-9">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="t-label">{caption}</span>
        <span className="t-label">{axisLabel}</span>
      </figcaption>

      <div aria-hidden="true" className="flex flex-col gap-5">
        {rows.map((row) => {
          /* A share of the largest bar, floored so that a genuine nought is
             still a visible mark rather than an absence that reads as a
             rendering fault. The floor is two pixels of a track, and the label
             beside it says nought. */
          const share = largest > 0 ? (row.value / largest) * 100 : 0;
          return (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-[15px] text-ink">{row.label}</span>
                <span
                  className={`tnum text-[17px] ${
                    row.tone === "flag"
                      ? "font-medium text-flag"
                      : row.tone === "pass"
                        ? "text-pass"
                        : "text-ink"
                  }`}
                >
                  {row.display}
                </span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-rule">
                <div
                  className={`h-full rounded-full ${
                    row.tone === "flag" ? "bg-flag" : row.tone === "pass" ? "bg-pass" : "bg-ink"
                  }`}
                  style={{ width: `max(0.5rem, ${share}%)` }}
                />
              </div>
              {row.note ? <p className="text-[13px] text-muted">{row.note}</p> : null}
            </div>
          );
        })}
      </div>

      <p className="measure text-[15px] leading-relaxed text-muted">{reading}</p>
    </figure>
  );
}
