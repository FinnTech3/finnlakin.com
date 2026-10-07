import { clamp, easeForFrame } from "./pack";
import { chainOf, shapeSlot } from "./structures";
import type { LaneSeam, LaneState, PageLayout, ScrollState } from "./types";

/* Scroll position, as a number of bands.

   The obvious implementation divides scroll by the document height and
   multiplies by the length of the timeline, and it is wrong for this page,
   because the bands are not equal heights: a long run of project entries and a
   short contact band would get the same share of the timeline, so the cloud
   would race through the reading and dawdle over the footer.

   So the boundaries are read off the real bands. Band n's top reaching the top
   of the viewport is progress n exactly, and between two boundaries the
   progress is the fraction of the way between them.

   A band is anything on the page that carries data-band, which is the hero, every
   section of the home page, and each pair of projects within the work: the work
   is long enough that the cloud has to change sides and shape several times
   inside it, so it is not one band. What a band says about itself, in the
   markup, is which side the cloud keeps (its band-lane class) and what shape it
   wants to be (its data-shape). The engine reads both off the page rather than
   being told, because a second statement of either would drift from the first.

   The timeline used to be stretched across a fixed six gaps, so that a section
   could be added without re-cutting every ramp in it. It is not now: its ramps
   are in bands, a band is added by writing it, and the choreography follows
   from what the bands say. */

/* Every band, in document order. */
const BAND_SELECTOR = "[data-band]";

/* How fast the timeline may travel when the page jumps rather than scrolls, in
   bands a second. The call to action in the hero is an anchor to the contact
   section and the button at the foot of the page goes the other way, so
   following either moves the scroll the whole length of the page in one go, and
   the eased value would cross the whole choreography in a frame. This is the
   same journey time as it was when the page had seven sections and the limit was
   four: the page has about a third more bands. */
export const MAX_BANDS_PER_SECOND = 6.5;

/* The width at which the bands keep a lane beside their content, and so the
   width at which the cloud has a column. The same number is in globals.css,
   twice, and tests/backdrop.spec.ts asserts all three agree either side of it:
   they were three different breakpoints, and between them the cloud was cut to
   a lane the page had already collapsed. */
const LANE_QUERY = "(min-width: 1100px)";

/* The margin kept between the cloud and the nearest line of text when it
   crosses on a seam, in CSS pixels, on top of however far the page scrolled
   in the last frame. */
const SEAM_MARGIN_PX = 16;

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
  const limit = MAX_BANDS_PER_SECOND * Math.max(0, deltaSeconds);
  return current + clamp(gap * easeForFrame(ease, deltaSeconds), -limit, limit);
}

export class ScrollController {
  private state: ScrollState = { sectionProgress: 0, target: 0 };
  private boundaries: number[] = [];
  private lanes: number[] = [];
  /* The slot each band wants for its shape, its place in the chain of shapes
     (which counts a run of bands that want the same one once), and the chain
     itself. */
  private shapes: number[] = [];
  private chainIndex: number[] = [];
  private chainSlots: number[] = [];
  /* The padding either side of each boundary, which is the text-free seam. */
  private seamAbove: number[] = [];
  private seamBelow: number[] = [];
  private page: PageLayout = { wide: true, slot: null };
  private lastY: number | null = null;
  private drift = 0;
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

  /* Whether the page has given the cloud a lane, and where the phone's slot
     is. Read in measure(), with everything else that asks the layout a
     question, and never in the frame loop. */
  get layout(): PageLayout {
    return this.page;
  }

  /* The shapes the page asks for from the top to the bottom, as slots of the
     target texture. At least one: a page with no bands asks for the brain. */
  get chain(): readonly number[] {
    return this.chainSlots.length > 0 ? this.chainSlots : [0];
  }

  private bands(): HTMLElement[] {
    if (typeof document === "undefined") return [];
    return Array.from(document.querySelectorAll<HTMLElement>(BAND_SELECTOR));
  }

  /* Measures now, and again whenever the page can have moved underneath.

     Measuring once was a real fault rather than a theoretical one. It ran from
     resize, and resize runs at startup, which is before the web fonts have
     arrived. Fonts change the height of every block of text on the page, so
     every band below the first moves, sometimes by hundreds of pixels, and
     the timeline spent the rest of the session mapped to positions the page no
     longer had: the cloud reached the explosion while the reader was still in
     the work section.

     So: once now, once when the fonts land, and again whenever a band or the
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
         several entries, and a measurement reads a bounding rectangle for every
         band. */
      if (this.queued || !this.live) return;
      this.queued = true;
      requestAnimationFrame(() => {
        this.queued = false;
        if (this.live) this.measure();
      });
    });
    for (const element of this.bands()) this.observer.observe(element);
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
    const shapes: number[] = [];
    const padTop: number[] = [];
    const padBottom: number[] = [];
    for (const element of this.bands()) {
      tops.push(element.getBoundingClientRect().top + window.scrollY);
      /* The band's padding is the text-free part of the seam either side of
         its boundary: the only road across the page. Read off the inner, which
         is what carries it. */
      const inner = element.firstElementChild as HTMLElement | null;
      const style = inner ? getComputedStyle(inner) : null;
      padTop.push(style ? Number.parseFloat(style.paddingTop) || 0 : 0);
      padBottom.push(style ? Number.parseFloat(style.paddingBottom) || 0 : 0);
      /* Which side of this band the cloud travels down, read off the markup
         rather than worked out again here.

         It was worked out again here, as a stack of ramps in timeline.ts, and
         the two disagreed: measured at 85% of the document the layout had put
         its content on the right and the cloud was on the right with it, over
         the words, because the ramps were a guess about where each section sits
         in the progress range and the sections are not equal heights. Reading
         the class is the only version of this that cannot drift, because there
         is then only one statement of it. The shape is read the same way, for
         the same reason. */
      lanes.push(
        element.classList.contains("band-lane-left")
          ? -1
          : element.classList.contains("band-lane-right")
            ? 1
            : 1,
      );
      shapes.push(shapeSlot(element.dataset.shape));
    }
    this.lanes = lanes;
    this.shapes = shapes;
    this.seamAbove = padBottom;
    this.seamBelow = padTop;

    /* The chain of shapes: a run of bands that want the same one is a single
       link, because nothing changes between them. A band's place in the chain
       is how many changes of shape have come before it. */
    const { chain, index } = chainOf(shapes);
    this.chainIndex = index;
    this.chainSlots = chain;

    /* The last boundary, clamped to the furthest the page can actually scroll.

       The final band is shorter than a viewport, so its top never reaches the
       top of the screen: measured, the contact section began at 16,166 pixels on
       a document whose maximum scroll position is 16,130. Its progress was
       unreachable by thirty six pixels, which meant the last shape on the page
       never finished forming and the cloud ended the page mid-morph.

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
    this.page = this.measureLayout();
  }

  private measureLayout(): PageLayout {
    const wide =
      typeof window.matchMedia === "function"
        ? window.matchMedia(LANE_QUERY).matches
        : window.innerWidth >= 1100;
    if (wide) return { wide, slot: null };

    /* The slot against the canvas it is drawn in, both read at the same
       instant, so their difference is layout and not scroll. Clipped to the
       canvas, which covers the first screen: a slot that runs on below it has
       only the part inside to be drawn in. */
    const slot = document.querySelector<HTMLElement>("[data-brain-slot]");
    const host = document.querySelector<HTMLElement>("[data-brain]");
    if (!slot || !host) return { wide, slot: null };
    const room = slot.getBoundingClientRect();
    const canvas = host.getBoundingClientRect();
    if (canvas.height <= 0 || room.height <= 0) return { wide, slot: null };
    const top = Math.max(room.top, canvas.top) - canvas.top;
    const bottom = Math.min(room.bottom, canvas.bottom) - canvas.top;
    const px = bottom - top;
    if (px <= 0) return { wide, slot: null };
    return {
      wide,
      slot: {
        centre: 1 - (top + bottom) / 2 / canvas.height,
        half: px / 2 / canvas.height,
        px,
      },
    };
  }

  private progressFor(scrollY: number) {
    const tops = this.boundaries;
    if (tops.length < 2) {
      /* No bands on this route, so fall back to the plain proportion of a
         single band's worth. */
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(scrollY / max, 0, 1);
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

  /* Which lanes and shapes are where on the screen, and the seams between them.

     Where the cloud changes sides used to be decided here as a stretch of each
     section's progress, from 38% to 72% of the way through it, and that put
     the crossing in the right place on one screen size. It has to happen when
     the seam reaches the cloud, and where the seam is at a given progress
     depends on how tall the band is against how tall the window is: measured at
     1920 by 1080, the seam had already passed above the cloud when the crossing
     began. So this reports where the seams are, and the timeline crosses as one
     passes the cloud's own height.

     A seam is a boundary where either thing changes. The final pass only splits
     the screen at the ones where the lane does, and the timeline changes the
     cloud's shape at the ones where that does. */
  laneState(): LaneState {
    const lanes = this.lanes;
    const tops = this.boundaries;
    const chain = this.chain;
    if (typeof window === "undefined" || lanes.length < 2) {
      return { here: lanes[0] ?? 1, hereChain: 0, chain, seams: [] };
    }
    const height = Math.max(1, window.innerHeight);
    const scrollY = window.scrollY;

    const middle = scrollY + height / 2;
    let here = lanes[0] ?? 1;
    let hereChain = this.chainIndex[0] ?? 0;
    for (let i = 0; i < tops.length; i++) {
      if (middle >= tops[i]!) {
        here = lanes[i] ?? here;
        hereChain = this.chainIndex[i] ?? hereChain;
      }
    }

    const seams: LaneSeam[] = [];
    for (let i = 1; i < lanes.length; i++) {
      const sameLane = lanes[i] === lanes[i - 1];
      const sameShape = this.chainIndex[i] === this.chainIndex[i - 1];
      if (sameLane && sameShape) continue;
      const above = this.seamAbove[i - 1] ?? 0;
      const below = this.seamBelow[i] ?? 0;
      /* The text-free band runs from the last line of one band to the first of
         the next, which is the boundary less the padding above it and plus
         the padding below it. */
      const top = tops[i]! - above;
      const bottom = tops[i]! + below;
      const centre = (top + bottom) / 2 - scrollY;
      const uv = 1 - centre / height;
      if (uv < -0.5 || uv > 1.5) continue;
      const clear = Math.max(0, (bottom - top) / 2 - SEAM_MARGIN_PX);
      seams.push({
        uv,
        above: lanes[i - 1]!,
        below: lanes[i]!,
        aboveChain: this.chainIndex[i - 1]!,
        belowChain: this.chainIndex[i]!,
        clear: clear / height,
        half: Math.max(0, clear - this.drift) / height,
      });
    }
    seams.sort((a, b) => b.uv - a.uv);
    return { here, hereChain, chain, seams };
  }

  read() {
    if (typeof window === "undefined") return;
    const y = window.scrollY;
    /* How far the page moved since the last frame, which is how far ahead of
       this frame's picture the compositor can have scrolled the page: the seam
       the cloud crosses on is narrowed by it, so a mask a frame behind a fling
       still cannot reach a line of text. */
    this.drift = this.lastY === null ? 0 : Math.abs(y - this.lastY);
    this.lastY = y;
    this.state.target = this.progressFor(y);
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

  /* Reduced motion and the still frame want the answer now, not eased into.

     The target is read afresh, because the first frame and the hand-over come
     here without a read before them. The drift is left alone: it is how far the
     page moved between two frames, measured once a frame by read(), and this
     used to measure it again straight after, found the page had not moved,
     and under reduced motion left every frame with no margin for a fling. */
  settle() {
    if (typeof window !== "undefined") this.state.target = this.progressFor(window.scrollY);
    this.state.sectionProgress = this.state.target;
    return this.state.sectionProgress;
  }
}
