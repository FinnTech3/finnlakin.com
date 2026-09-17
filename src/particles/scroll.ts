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

export class ScrollController {
  private state: ScrollState = { sectionProgress: 0, target: 0 };
  private boundaries: number[] = [];
  private ease: number;

  constructor(ease: number) {
    this.ease = ease;
  }

  get value(): ScrollState {
    return this.state;
  }

  /* Measured on layout and on resize, never in the frame loop. Reading
     offsetTop forces the browser to settle pending layout, and doing that every
     frame is how a smooth animation quietly becomes a janky one. */
  measure() {
    if (typeof document === "undefined") return;
    const tops: number[] = [];
    for (const id of SECTIONS) {
      const element = document.getElementById(id);
      if (!element) continue;
      tops.push(element.getBoundingClientRect().top + window.scrollY);
    }
    this.boundaries = tops;
  }

  private progressFor(scrollY: number) {
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
    const step = easeForFrame(this.ease, deltaSeconds);
    this.state.sectionProgress +=
      (this.state.target - this.state.sectionProgress) * step;
    return this.state.sectionProgress;
  }

  /* Reduced motion and the still frame want the answer now, not eased into. */
  settle() {
    this.read();
    this.state.sectionProgress = this.state.target;
    return this.state.sectionProgress;
  }
}
