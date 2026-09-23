import { reconstructions } from "@/lib/reconstructions";
import { ShinyButton } from "@/components/shiny-button";
import { person } from "@/lib/site";

/* The stage: the opening, and where the cloud's choreography starts.

   Its inner panel is sticky, so a reader scrolls about a screen of travel while
   the panel stays pinned and the copy rises past it. The cloud runs the first
   part of its choreography in the right of the screen, in a column the copy
   does not enter.

   Everything on this side of the screen is in the flow of that column, cards
   included. They used to be absolutely positioned over on the cloud's side and
   animated on keyframes of their own, which is the reference site's trick, and
   it produced exactly the thing it looks like: white cards sitting on top of
   the brain. Nothing goes over the cloud now and the cloud goes over nothing,
   and that is a property of the layout rather than two animations that happen
   to clear each other at both ends.

   It is two screens: one of travel with the panel pinned, and a second carrying
   the panel back off the top. */
export function Hero() {
  return (
    <section
      id="hero"
      data-stage=""
      /* Two screens: one of travel with the panel pinned, and the second
         carrying the panel back off the top as the black fades. A phone gets
         slightly less, because a phone scrolls a viewport in a flick. */
      className="stage relative h-[200vh] w-full sm:h-[220vh]"
    >
      <div className="stage-panel-inner sticky top-0 flex h-screen w-full items-center overflow-hidden">
        {/* Hard left rather than centred in the 1200px measure. The name is the
            first thing on the site and it was sitting a fifth of the way in
            from the edge with the cloud pushed off to the far right; anchored
            to the gutter it has the left half of the screen and the cloud has
            the right, which is the composition the stage was always for. */}
        <div className="stage-panel relative w-full">
          {/* The copy. It rises as the stage is scrolled, which is the "text
              moves around the brain" the brief asks for: the cloud holds its
              position on the screen while the words travel past it. */}
          <div className="stage-copy max-w-[34rem] lg:max-w-[38rem]">
            <p className="t-label flex items-center gap-2.5 text-pass">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
              Available Summer 2026
            </p>

            {/* Shrink to fit, so the heading's box is the width of its letters
                rather than the width of the column. The contrast suite measures
                the brightest pixel inside a run of text's box, and a block level
                heading whose box runs on past the last letter measures whatever
                is behind that empty space: here, the cloud, at a luminance of
                0.65 against white type. The overlap it was reporting is real
                where the box is, and there are no letters there. */}
            <h1 className="t-display-lg mt-6 w-fit text-ink">{person.name}</h1>

            <p className="t-sub mt-7 max-w-[26ch] text-pretty text-ink-soft">
              I rebuild published numbers from primitives and report the gap.{" "}
              <em className="font-serif text-ink italic">
                Sometimes the gap is the finding.
              </em>
            </p>

            {/* Both controls on the component Finn supplied.

                It replaces the brief's matched pair, one filled pill and one
                ghost, and that pair was carrying the hierarchy: contact was the
                primary action and the work was the secondary one. Two identical
                animated controls say the two are equally weighted. That is worth
                knowing rather than quietly fixing, because the instruction was
                to use it on both, and a muted second variant is a small change
                if the flattening turns out to be wrong. */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ShinyButton href="#contact">Get in touch</ShinyButton>
              <ShinyButton href="#work">See the work</ShinyButton>
            </div>

            <p className="t-caption mt-8 max-w-[44ch] text-muted">
              {person.course}, {person.university}. Exchange year at{" "}
              {person.exchange}. Class of {person.graduation}.
            </p>

            {/* The artifacts, in the flow of the copy column rather than placed
                on top of the cloud.

                They were absolutely positioned in the cloud's half, low and to
                the right, and travelled on keyframes of their own. That is the
                reference site's trick and it was the wrong one here, for the
                reason Finn gave: a white card laid over the brain is something
                going over the brain. Nothing goes over it now and it goes over
                nothing, which is a rule about the whole page and not a
                placement that happens to clear at the two ends of an animation.

                In the flow they also cannot land on the call to action, which
                is a fault this stage has now shipped twice from cards placed by
                eye. There is no eye involved any more. */}
            <div className="mt-10 grid gap-4 sm:grid-cols-[1.35fr_1fr]">
              {/* Artifact one: the four reconstructions. This is the claim the
              whole site is evidence for, so it is the artifact that gets the
              room, and it is a table rather than a picture of one. */}
              <figure className="stage-artifact stage-artifact-table shadow-artifact">
                <figcaption className="t-label px-1 pb-3">
                  Four reconstructions, against the published series
                </figcaption>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-rule">
                      <th
                        scope="col"
                        className="t-caption pr-3 pb-2 font-normal text-muted"
                      >
                        Quantity
                      </th>
                      <th
                        scope="col"
                        className="t-caption pb-2 text-right font-normal text-muted"
                      >
                        Deviation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="settle-rows">
                    {reconstructions.map((row) => (
                      <tr
                        key={row.quantity}
                        className="border-b border-rule last:border-b-0"
                      >
                        <td className="py-2.5 pr-3 align-top">
                          <span className="block text-[15px] text-ink">
                            {row.quantity}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {row.reference}
                          </span>
                        </td>
                        <td className="py-2.5 text-right align-top">
                          <span
                            className={`tnum text-[15px] ${
                              row.tone === "flag"
                                ? "font-medium text-flag"
                                : "text-ink"
                            }`}
                          >
                            {row.deviation}
                          </span>
                          <span
                            className={`mt-0.5 block text-[12px] ${
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
              </figure>

              {/* Artifact two: the one row of the table above that did not hold,
              pulled out on its own. It travels at a different rate from the
              table, which is the reference site's whole trick for making a
              scroll feel like depth rather than like a page moving. */}
              <figure className="stage-artifact stage-artifact-stat shadow-artifact">
                <figcaption className="t-label pb-2">
                  Term premium, ten year
                </figcaption>
                <p className="tnum text-[28px] leading-none text-ink">14 bp</p>
                <p className="mt-2 text-[13px] leading-snug text-muted">
                  against 0.45 bp on the curve it is drawn from, from the same
                  model, the same data and the same estimation window.
                </p>
                <p className="mt-3 text-[13px] font-medium text-flag">
                  31× the fitted error
                </p>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
