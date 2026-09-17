import { reconstructions } from "@/lib/reconstructions";
import { person } from "@/lib/site";

/* The design reference puts a particle visualisation beside the headline. This
   site has something better to put there: the four reconstructions, which are
   the claim the rest of the page is evidence for. The decorative version of
   that idea is already running behind the whole page.

   Every row, every caveat and every figure from the previous design survives.
   What went is the box around them. */
export function Hero() {
  return (
    <section id="hero" className="gutter w-full pt-8 pb-24 sm:pt-16 sm:pb-32">
      <p className="t-label flex items-center gap-2.5 text-pass">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        Available Summer 2026
      </p>

      {/* Half width on a wide screen, because the particle cloud rests in the
          other half. It is a fixed background rather than a column, so the
          space is reserved here rather than occupied by an element. */}
      <div className="mt-8 lg:w-1/2 lg:pr-8">
        <div>
          <h1 className="t-display text-ink">{person.name}</h1>

          <p className="t-sub mt-10 max-w-[22ch] text-pretty text-ink">
            I rebuild published numbers from primitives and report the gap.{" "}
            <em className="text-spark not-italic">Sometimes the gap is the finding.</em>
          </p>

          <p className="mt-8 max-w-[46ch] text-[18px] leading-relaxed font-extralight text-ink-soft">
            {person.course}, {person.university}. Exchange year at {person.exchange}.
            Class of {person.graduation}.
          </p>

          {/* The one filled control on the page. The reference reserves the
              violet for exactly this and nothing else. */}
          <a
            href="#contact"
            className="t-label mt-10 inline-flex min-h-11 items-center rounded-full bg-action px-6 text-action-ink hover:opacity-90"
          >
            Get in touch
          </a>
        </div>

      </div>

      <table className="mt-20 w-full border-collapse text-left">
          <caption className="t-label pb-4 text-left text-muted">
            Four reconstructions, against the published series
          </caption>
          <thead>
            <tr className="border-b border-rule-strong">
              <th scope="col" className="t-caption pr-4 pb-3 font-normal uppercase tracking-[0.1em] text-muted">
                Quantity
              </th>
              <th scope="col" className="t-caption hidden pr-4 pb-3 font-normal uppercase tracking-[0.1em] text-muted sm:table-cell">
                Reference
              </th>
              <th scope="col" className="t-caption pb-3 text-right font-normal uppercase tracking-[0.1em] text-muted">
                Deviation
              </th>
            </tr>
          </thead>
          <tbody className="settle-rows">
            {reconstructions.map((row) => (
              <tr key={row.quantity} className="border-b border-rule last:border-b-0">
                <td
                  className={`py-5 pr-4 align-top ${
                    row.tone === "flag" ? "border-l-2 border-flag pl-4" : ""
                  }`}
                >
                  <span className="text-[17px] text-ink">{row.quantity}</span>
                  <span className="mt-1 block text-[14px] text-muted">{row.detail}</span>
                  <span className="mt-1 block text-[14px] text-muted sm:hidden">
                    Against {row.reference}
                  </span>
                </td>
                <td className="hidden py-5 pr-4 align-top text-[15px] text-ink-soft sm:table-cell">
                  {row.reference}
                </td>
                <td className="py-5 text-right align-top">
                  <span
                    className={`tnum text-[17px] ${
                      row.tone === "flag" ? "font-medium text-flag" : "text-ink"
                    }`}
                  >
                    {row.deviation}
                  </span>
                  <span
                    className={`mt-1 block text-[13px] ${
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

      <p className="measure mt-14 border-t border-rule pt-7 text-[16px] leading-relaxed font-extralight text-muted">
        The yield curve reproduces to less than half a basis point. The premium
        drawn out of that same curve reproduces to fourteen, and moving the
        estimation start date from 1961 to 2000 moves the ten-year premium by
        eighty-one. The fit is pinned down. The decomposition is not.
      </p>
    </section>
  );
}
