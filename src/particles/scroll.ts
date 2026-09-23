import { clamp, easeForFrame } from "./pack";
import type { LaneState, ScrollState } from "./types";

/* Scroll position, as a number from nought to six.

   The obvious implementation divides scroll by the document height and
   multiplies by six, and the specification allows it. It is also wrong for this
   page, because the sections are not equal heights: a long prose section and a
   short contact section would get the same share of the timeline, so the cloud
   would race through the reading and dawdle over the footer.

   So the boundaries are read off the real sections. Section n's top reaching
   the top of the viewport is progress n exactly, and between two boundaries the
   progress is the fraction of the way between them.

   This was briefly measured off the dark stage's own travel instead, because
   the cloud was drawn additively and had to be gone by the time the paper
   began: the whole choreography was compressed into the one band it could be
   seen in. The cloud is read as ink on the paper half now, so it travels the
   whole document again and the section measurement is simply the right one.
   The change here was a deletion. */

const SECTIONS = ["hero", "work", "about", "path", "skills", "endorsements", "contact"];

/* The range the timeline is choreographed against, kept fixed while the number
   of sections is not.

   Progress used to be the section index itself, which quietly made the
   choreography depend on there being exactly seven sections: moving one to its
   own page took the last state off the end of the timeline, and the cloud
   finished the page mid-morph. Normalising by the number of gaps means a
   section can be added or moved without re-cutting every ramp in timeline.ts,
   which is a thing that is going to happen again. */
const RANGE = 6;

const MAX_SECTIONS_PER_SECOND = 4;

/* How far through a section the change of sides happens.

   It ran 0.60 to 0.95, which put the crossing hard against the boundary and
   left the cloud still moving as the next heading arrived. Brought forward, the
   cloud is settled in its new column well before the incoming section fills the
   screen, and the seam it crosses on is nearer the middle of the viewport where
   there is most room either side of it. */
const CROSS_FROM = 0.38;
const CROSS_TO = 0.72;

/* One eased, capped step of the timeline towards where the page is.

   Exported and pure so that the cap can be asserted rather than looked at: the
   failure it guards against is a jump that is over before a frame can be
   sampled, which is precisely the kind of thing a browser test cannot catch on
   a machine drawing two frames a second. */
export function stepToward(
  current: number,
  target: number,
  ease: number,
  deltaSeconds: number,
): number {
  const gap = target - current;
  /* Eased, then capped. The easing is what makes scrolling back reverse the
     animation smoothly; the cap is what stops a jump to an anchor being treated
     as a very fast scroll. */
  const limit = MAX_SECTIONS_PER_SECOND * Math.max(0, deltaSeconds);
  return current + clamp(gap * easeForFrame(ease, deltaSeconds), -limit, limit);
}

export class ScrollController {
  private state: ScrollState = { sectionProgress: 0, target: 0 };
  private boundaries: number[] = [];
  private lanes: number[] = [];
  private ease: number;
  private observer: ResizeObserver | null = null;
  private queued = false;
  private live = false;

  constructor(ease: number) {
    this.ease = ease;
  }

  get value(): ScrollState {
    return this.state;
  }

  /* Measures now, and again whenever the page can have moved underneath.

     Measuring once was a real fault rather than a theoretical one. It ran from
     resize, and resize runs at startup, which is before the web fonts have
     arrived. Fonts change the height of every block of text on the page, so
     every section below the first moves, sometimes by hundreds of pixels, and
     the timeline spent the rest of the session mapped to positions the page no
     longer had: the cloud reached the explosion while the reader was still in
     the work section.

     So: once now, once when the fonts land, and again whenever a section or the
     body changes size. Images finishing, a chart laying out, an expanded
     details element and a rotated phone all move the boundaries and none of
     them is a window resize. */
  watch() {
    if (typeof document === "undefined") return;
    this.live = true;
    this.measure();

    document.fonts?.ready
      .then(() => {
        if (this.live) this.measure();
      })
      .catch(() => {
        /* A browser that refuses to resolve it still gets the measurement
           above and the observer below. */
      });

    if (typeof ResizeObserver === "undefined") return;
    this.observer = new ResizeObserver(() => {
      /* Coalesced onto a frame. One reflow changes several boxes and delivers
         several entries, and a measurement reads seven bounding rectangles. */
      if (this.queued || !this.live) return;
      this.queued = true;
      requestAnimationFrame(() => {
        this.queued = false;
        if (this.live) this.measure();
      });
    });
    for (const id of SECTIONS) {
      const element = document.getElementById(id);
      if (element) this.observer.observe(element);
    }
    if (document.body) this.observer.observe(document.body);
  }

  unwatch() {
    this.live = false;
    this.observer?.disconnect();
    this.observer = null;
  }

  /* Measured on layout, on resize and on reflow, never in the frame loop.
     Reading a bounding rectangle forces the browser to settle pending layout,
     and doing that every frame is how a smooth animation quietly becomes a
     janky one. */
  measure() {
    if (typeof document === "undefined") return;

    const tops: number[] = [];
    const lanes: number[] = [];
    for (const id of SECTIONS) {
      const element = document.getElementById(id);
      if (!element) continue;
      tops.push(element.getBoundingClientRect().top + window.scrollY);
      /* Which side of this band the cloud travels down, read off the markup
         rather than worked out again here.

         It was worked out again here, as a stack of ramps in timeline.ts, and
         the two disagreed: measured at 85% of the document the layout had put
         its content on the right and the cloud was on the right with it, over
         the words, because the ramps were a guess about where each section sits
         in the progress range and the sections are not equal heights. Reading
         the class is the only version of this that cannot drift, because there
         is then only one statement of it. */
      lanes.push(
        element.classList.contains("band-lane-left")
          ? -1
          : element.classList.contains("band-lane-right")
            ? 1
            : 1,
      );
    }
    this.lanes = lanes;
    /* The last boundary, clamped to the furthest the page can actually scroll.

       The final section is shorter than a viewport, so its top never reaches the
       top of the screen: measured, the contact section began at 16,166 pixels on
       a document whose maximum scroll position is 16,130. Progress six was
       unreachable by thirty six pixels, which meant the reassembly at the end of
       the timeline never played and the cloud finished the page mid-morph.

       Clamped, the bottom of the document is the end of the timeline, which is
       what a reader means by reaching the end. */
    const reachable = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    if (tops.length > 1) {
      const last = tops.length - 1;
      tops[last] = Math.min(tops[last]!, reachable);
      /* And it must still be past the one before it, or the final span is zero
         and the division below is a divide by nothing. */
      tops[last] = Math.max(tops[last]!, tops[last - 1]! + 1);
    }

    this.boundaries = tops;
  }

  private progressFor(scrollY: number) {
    const tops = this.boundaries;
    if (tops.length < 2) {
      /* No sections on this route, so fall back to the plain proportion. */
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp((scrollY / max) * RANGE, 0, RANGE);
    }

    const last = tops.length - 1;
    const step = RANGE / last;
    if (scrollY <= tops[0]!) return 0;
    if (scrollY >= tops[last]!) return RANGE;

    for (let i = 0; i < last; i++) {
      const from = tops[i]!;
      const to = tops[i + 1]!;
      if (scrollY < to) {
        const span = Math.max(1, to - from);
        return (i + (scrollY - from) / span) * step;
      }
    }
    return RANGE;
  }

  /* Which lane the cloud should be in at a given progress, and how far through
     a change of sides it is.

     The crossing happens in the last fifth of a section rather than at its
     boundary, so the cloud is already in the new lane by the time the incoming
     heading reaches the top of the screen. Straddling the boundary put it
     halfway across at the exact moment a heading arrived. */
  laneAt(progress: number): LaneState {
    const lanes = this.lanes;
    const idle = (side: number): LaneState => ({
      from: side,
      to: side,
      amount: 0,
      gapUv: 0.5,
    });
    if (lanes.length < 2) return idle(1);

    const step = RANGE / (lanes.length - 1);
    const at = clamp(progress / step, 0, lanes.length - 1);
    const index = Math.min(lanes.length - 1, Math.floor(at));
    const here = lanes[index] ?? 1;
    const next = lanes[Math.min(lanes.length - 1, index + 1)] ?? here;
    if (here === next) return idle(here);

    const through = at - index;
    if (through <= CROSS_FROM) return idle(here);
    if (through >= CROSS_TO) return idle(next);

    return {
      from: here,
      to: next,
      amount: (through - CROSS_FROM) / (CROSS_TO - CROSS_FROM),
      gapUv: this.gapUv(index + 1),
    };
  }

  /* Where the seam between two sections currently is, as a fraction up the
     screen, with nought at the bottom because that is the space the final pass
     samples in.

     This is the only horizontal road across the page. Everywhere else at a
     given scroll position there is a paragraph, so a cloud that changes sides
     anywhere else changes sides through somebody's sentence, which is the
     whole complaint. The seam is the band of vertical padding between one
     section and the next, it moves up the screen as the page scrolls, and the
     crossing rides it. */
  private gapUv(boundary: number): number {
    const tops = this.boundaries;
    const top = tops[boundary];
    if (top === undefined || typeof window === "undefined") return 0.5;
    const height = Math.max(1, window.innerHeight);
    const css = top - window.scrollY;
    return clamp(1 - css / height, 0, 1);
  }

  read() {
    if (typeof window === "undefined") return;
    this.state.target = this.progressFor(window.scrollY);
  }

  update(deltaSeconds: number) {
    this.state.sectionProgress = stepToward(
      this.state.sectionProgress,
      this.state.target,
      this.ease,
      deltaSeconds,
    );
    return this.state.sectionProgress;
  }

  /* Reduced motion and the still frame want the answer now, not eased into. */
  settle() {
    this.read();
    this.state.sectionProgress = this.state.target;
    return this.state.sectionProgress;
  }
}
