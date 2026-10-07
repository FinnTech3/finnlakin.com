import { CtaVisibility } from "@/components/cta-visibility";
import { Ledger } from "@/components/ledger";
import { ShinyButton } from "@/components/shiny-button";
import type { BandPlan } from "@/lib/bands";
import { projects } from "@/lib/projects";
import { held, rebuiltWord, reconstructions } from "@/lib/reconstructions";
import { person } from "@/lib/site";

/* The opening, and where the cloud's choreography starts.

   An ordinary section on the wall, not a pinned stage. It used to be two screens
   of scroll with the copy riding a sticky panel past a cloud that held its
   place, on a black stage that only existed so the cloud had somewhere to be
   seen. On a pale wall the cloud is ink and needs no stage, and the engine
   works from the section's own geometry, so the hero is a block like any other
   and the page scrolls normally through it.

   Everything on this side of the screen is in the flow of the column the lane
   leaves, the evidence included. Nothing goes over the cloud and the cloud goes
   over nothing, and that is a property of the layout rather than two
   animations that happen to clear each other at both ends.

   The first screen carries the name, the standfirst and the two controls, and
   starts on what it is. The first impression of a page is formed on how busy it
   is: shown 119 real sites at exposures down to 17 milliseconds,
   people rated the visually complex ones worse at every exposure, which is
   less than a frame and long before anything has been read. ATTENTION.md has
   the study. So the evidence arrives on the way down, where a reader is
   already committed, under a heading of its own, because headings are what the
   eye lands on when it scans rather than reads. */
export function Hero({ band }: { band: BandPlan }) {
  /* Split on the space, so the name is one string in one place and the two
     halves are stacked by the layout rather than typed twice. The text content
     of the heading stays "Finn Lakin", with the space in it. */
  const [first, ...rest] = person.name.split(" ");
  const last = rest.join(" ");

  /* The row that did not hold, and the row beside it that did, so the figure
     beside the table is read off the table and not typed a second time. */
  const flagged = reconstructions.find((row) => row.tone === "flag");
  const against = reconstructions.find(
    (row) => row.projectSlug === flagged?.projectSlug && row.tone === "pass",
  );

  return (
    <section
      id="hero"
      className={`band-lane-${band.lane}`}
      data-band=""
      data-shape={band.shape}
    >
      {/* The room above the name is a short one. The seam the engine reads is
          the padding between two sections, and nothing is above this one but
          the header, so it does not need a section's worth. */}
      <div className="band-inner section-pad pt-6 md:pt-10">
        {/* One above the other on a phone and side by side from 640 up, and not
            left to wrap. The two labels together are wider than a phone, so they
            used to start on one line in the stand-in face and wrap onto two when
            the real one arrived, which moved the name and everything under it by
            a line. A row that cannot wrap does not change its mind. */}
        <div className="flex flex-col gap-y-2 min-[640px]:flex-row min-[640px]:items-baseline min-[640px]:justify-between min-[640px]:gap-x-6">
          <span className="t-label">{person.location}</span>
          <span className="t-label">Index 01 to {String(projects.length).padStart(2, "0")}</span>
        </div>

        {/* Shrink to fit, so the heading's box is the width of its letters rather
            than the width of the column. The contrast suite measures what is
            behind a run of text's box, and a block level heading whose box runs
            on past the last letter measures whatever is behind that empty
            space.

            Pulled left by a twentieth of its own size, which is the left side
            bearing of the capital F at this size. Without it the stem of the
            letter starts a dozen pixels in from the line of everything else on
            the page, and at this size that reads as a mistake. */}
        <h1 className="t-display-lg mt-8 -ml-[0.05em] w-fit text-ink">
          {first} <span className="block">{last}</span>
        </h1>

        {/* The standfirst and the controls side by side from 720 pixels up, and
            in a column below it, in the order a phone should meet them: the
            standfirst, the controls, the cloud's space, and only then the
            paragraph.

            Side by side, and not the controls under the standfirst, because of
            where the fold is. They were under it, and measured at 1280 by 720
            they were below the screen, at 1366 by 768 as well, and at 1536 by
            730 by thirty pixels: the name takes most of the first screen on
            purpose, so anything stacked beneath the standfirst goes past the
            bottom of a laptop's window. A first screen that has to be scrolled
            to reach the controls is not carrying them. Beside it they are at
            the same height as the claim they act on, and that is on every
            screen this layout is used on. The paragraph is the one thing that
            is allowed to run past the fold. */}
        <div className="scored mt-10 grid gap-x-8 gap-y-8 pt-6 min-[720px]:grid-cols-2">
          <p className="t-sub max-w-[9.9em] text-ink">
            I rebuild published numbers from primitives and report the gap.
          </p>

          {/* Both controls on the component Finn supplied, re-skinned for the
              wall: square, carbon, with acid light running round the edge.

              It replaces the brief's matched pair, one filled and one ghost,
              and that pair was carrying the hierarchy: contact was the primary
              action and the work was the secondary one. Two identical animated
              controls say the two are equally weighted. That is worth knowing
              rather than quietly fixing, because the instruction was to use it
              on both, and a muted second variant is a small change if the
              flattening turns out to be wrong. */}
          <div data-cta-watch="" className="flex flex-wrap items-start gap-3 min-[720px]:self-start">
            <ShinyButton href="#contact">Get in touch</ShinyButton>
            <ShinyButton href="#work">See the work</ShinyButton>
          </div>
          <CtaVisibility />

          {/* Where the cloud lives on a screen too narrow to give it a column.

              Empty on purpose, and only laid out below 1100 pixels, where the
              bands stop keeping a lane. The engine measures it and draws the
              cloud inside it and nowhere else, so on a phone the brain sits
              under the controls in the first screen and leaves with it, and
              nothing below it on the page ever has the brain behind it. The
              canvas is positioned over this screen rather than fixed to the
              window, so it is scrolled by the compositor with the page, and a
              fast flick cannot leave the light a frame behind its space. Across
              both columns where there are two, so it is the width of the
              content and not half of it. */}
          <div className="brain-slot min-[720px]:col-span-2" data-brain-slot="" aria-hidden="true" />

          <p className="measure text-[0.875rem] leading-[1.7] text-ink-soft min-[720px]:col-span-2">
            Sometimes the gap is the finding. Economics, finance and software on one side; film,
            print, drawing and clothes on the other. It is one habit either way: take the finished
            thing apart, work out what it is made of, and write down what you found.
          </p>
        </div>

        {/* The claim the whole site is evidence for, so it gets the one inverted
            block on the page and the room: a table rather than a picture of
            one, and beside it the single row that did not hold, pulled out on
            its own. In the flow of the copy column, not on top of the cloud: the
            cards this replaces were absolutely positioned in the cloud's half,
            which is a white card laid over the brain, and that is something
            going over the brain. */}
        <div className="chalk-block @container mt-24">
          <h2 className="t-h">
            {rebuiltWord} rebuilt. {held} held.
          </h2>
          <p className="t-label mt-5 max-w-[56ch]">
            {person.course}, {person.university}. Exchange year at {person.exchange}. Class of{" "}
            {person.graduation}.
          </p>
          <p className="measure t-body-lg mt-5 text-ink-soft">
            {rebuiltWord} published quantities, rebuilt from primitives and checked against the
            source. The last row is the point of the table: the same model that pins the yield
            curve down cannot pin down the premium it draws out of it.
          </p>

          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 @3xl:grid-cols-[1.4fr_1fr]">
            <figure className="m-0 min-w-0">
              <figcaption className="t-label pb-3">
                {rebuiltWord} reconstructions, against the published series
              </figcaption>
              <Ledger />
            </figure>

            {flagged && against ? (
              <figure className="m-0 flex min-w-0 flex-col gap-3 @3xl:border-l-2 @3xl:border-rule @3xl:pl-8">
                <figcaption className="t-label">{flagged.quantity}, ten year</figcaption>
                <p className="font-display text-[4.5rem] leading-[0.85] font-bold uppercase">
                  {flagged.deviation}
                </p>
                <p className="t-caption leading-snug text-muted">
                  against {against.deviation} on the curve it is drawn from, from the same model,
                  the same data and the same estimation window.
                </p>
                <p className="t-caption">
                  <span className="flag">{flagged.verdict}</span>
                </p>
              </figure>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
