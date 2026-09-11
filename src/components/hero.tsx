import { reconstructions } from "@/lib/reconstructions";
import { person } from "@/lib/site";

export function Hero() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="inline-flex items-center gap-2 rounded-xs border border-pass px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-pass">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Available Summer 2026
        </p>

        <h1 className="mt-7 font-serif text-[clamp(2.5rem,9vw,4.5rem)] leading-[1.02] tracking-[-0.03em]">
          {person.name}
        </h1>

        <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-muted">
          {person.course}, {person.university}. Exchange year at {person.exchange}.
          Class of {person.graduation}.
        </p>

        <p className="mt-8 max-w-[42ch] text-pretty font-serif text-[clamp(1.25rem,3.4vw,1.75rem)] leading-[1.35]">
          I rebuild published numbers from primitives and report the gap.{" "}
          <em className="italic">Sometimes the gap is the finding.</em>
        </p>

        <table className="mt-12 w-full border-collapse text-left">
          <caption className="pb-3 text-left font-mono text-[10.5px] uppercase tracking-[0.11em] text-muted">
            Four reconstructions, against the published series
          </caption>
          <thead>
            <tr className="border-b border-rule-strong">
              <th
                scope="col"
                className="pb-2.5 pr-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted"
              >
                Quantity
              </th>
              <th
                scope="col"
                className="hidden pb-2.5 pr-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted sm:table-cell"
              >
                Reference
              </th>
              <th
                scope="col"
                className="pb-2.5 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted"
              >
                Deviation
              </th>
            </tr>
          </thead>
          <tbody>
            {reconstructions.map((row) => (
              <tr key={row.quantity} className="border-b border-rule last:border-b-0">
                <td
                  className={`py-3.5 pr-4 align-top ${
                    row.tone === "flag" ? "border-l-2 border-flag pl-3" : ""
                  }`}
                >
                  <span className="text-sm font-medium">{row.quantity}</span>
                  <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>
                  <span className="mt-1 block text-xs text-muted sm:hidden">
                    Against {row.reference}
                  </span>
                </td>
                <td className="hidden py-3.5 pr-4 align-top text-sm sm:table-cell">
                  {row.reference}
                </td>
                <td className="py-3.5 text-right align-top">
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      row.tone === "flag" ? "font-medium text-flag" : ""
                    }`}
                  >
                    {row.deviation}
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-[10.5px] ${
                      row.tone === "flag" ? "text-flag" : "text-pass"
                    }`}
                  >
                    {row.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 max-w-[64ch] border-t border-rule pt-5 text-[13px] leading-relaxed text-muted">
          The yield curve reproduces to less than half a basis point. The premium
          drawn out of that same curve reproduces to fourteen, and moving the
          estimation start date from 1961 to 2000 moves the ten-year premium by
          eighty-one. The fit is pinned down. The decomposition is not.
        </p>
      </div>
    </section>
  );
}
