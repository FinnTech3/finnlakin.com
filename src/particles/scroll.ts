import { clamp, easeForFrame } from "./pack";
import type { ScrollState } from "./types";

/* Scroll position, as a number from nought to six.

   The obvious implementation divides scroll by the document height and
   multiplies by six, and the specification allows it. It is also wrong for this
   page, because the sections are not equal heights: a long prose section and a
   short contact section would get the same share of the timeline, so the cloud
   would race through the reading and dawdle over the footer.

   So the boundaries are read off the real sections. Section n's top reaching
   the top of the viewport is progress n exactly, and between two boundaries the
   progress is the fraction of the way between them. Seven sections, six gaps,
   which is the range the timeline was written against. */

const SECTIONS = ["hero", "work", "about", "timeline", "skills", "endorsements", "contact"];

/* The stage is the tall dark band at the top of the home page, and where it
   exists it owns the whole timeline.

   The seven section boundaries below were the right measurement for a page
   that was dark all the way down, because the cloud travelled beside the text
   the whole way. It cannot any more: the page below the stage is paper white,
   and a cloud drawn with additive blending is invisible on white. So the
   choreography is compressed into the stage's own scroll, which is what the
   stage is tall for, and the cloud has faded out by the time the paper
   begins.

   The section measurement is kept rather than deleted. It is what every other
   route still uses, and it is what this one falls back to if the markup ever
   loses its stage. */
const STAGE = "[data-stage]";

/* How far into the stage's travel the timeline has finished. The last stretch
   is the cloud leaving: it has nowhere to go once the paper starts, so it
   arrives at the end of the choreography a little early and spends the
   remainder dissolving. */
const STAGE_TIMELINE_END = 0.86;

/* How fast the timeline is allowed to travel, in sections a second.

   Without this the eased progress is only ever a proportion of the gap, so a
   large gap is crossed quickly however large it is, and the gaps are not all
   made by scrolling. The call to action in the hero is an anchor to the contact
   section: following it takes the scroll from nought to six in one go, and the
   cloud then played the drift, the explosion, both morphs and the reassembly in
   about a second. That is not a transition, it is a flicker.

   Four a second means the whole page takes a second and a half at the fastest,
   which reads as a sweep rather than a glitch, and it binds on nothing a reader
   does with a wheel or a finger: normal scrolling never asks the timeline to
   move faster than about one section a second. */
const MAX_SECTIONS_PER_SECOND = 4;

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
  private stageTop = 0;
  private stageTravel = 0;
  private boundaries: number[] = [];
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
    const stage = document.querySelector(STAGE);
    if (stage) this.observer.observe(stage);
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

    const stage = document.querySelector(STAGE);
    if (stage) {
      const box = stage.getBoundingClientRect();
      const top = box.top + window.scrollY;
      /* The stage is a tall block with a sticky panel inside it, so its travel
         is its own height less the one viewport the panel occupies. That is
         exactly the distance over which the panel stays pinned, which is the
         distance the choreography has to happen in. */
      this.stageTop = top;
      this.stageTravel = Math.max(1, box.height - window.innerHeight);
    } else {
      this.stageTravel = 0;
    }

    const tops: number[] = [];
    for (const id of SECTIONS) {
      const element = document.getElementById(id);
      if (!element) continue;
      tops.push(element.getBoundingClientRect().top + window.scrollY);
    }
    this.boundaries = tops;
  }

  private progressFor(scrollY: number) {
    if (this.stageTravel > 0) {
      const through = (scrollY - this.stageTop) / this.stageTravel;
      return clamp((through / STAGE_TIMELINE_END) * 6, 0, 6);
    }

    const tops = this.boundaries;
    if (tops.length < 2) {
      /* No sections on this route, so fall back to the plain proportion. */
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp((scrollY / max) * 6, 0, 6);
    }

    const last = tops.length - 1;
    if (scrollY <= tops[0]!) return 0;
    if (scrollY >= tops[last]!) return last;

    for (let i = 0; i < last; i++) {
      const from = tops[i]!;
      const to = tops[i + 1]!;
      if (scrollY < to) {
        const span = Math.max(1, to - from);
        return i + (scrollY - from) / span;
      }
    }
    return last;
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
