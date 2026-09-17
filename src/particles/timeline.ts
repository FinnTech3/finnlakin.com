import { mapClamped } from "./pack";
import type { ParticleTimelineState } from "./types";

/* Scroll position in, everything the renderer needs out.

   Every value here is a stack of clamped linear ramps, each contributing
   nothing until the scroll enters its window and its full amount after it
   leaves. Stacked, they compose into a choreography: the cloud drifts left,
   comes apart, reassembles into something else, turns, and gathers again.

   Nothing is set from the scroll position directly. Every output eases towards
   its target, which is the whole reason scrolling backwards reverses the
   animation smoothly instead of snapping to wherever the page now is. */

/* The cloud's resting place. The specification's own base, and it sits low
   because the brain reads better with its mass below the centre line of the
   screen than straddling it. */
const BASE = { x: 0, y: -1.19, z: 0 };

/* Applied on top of the timeline rotation and kept separate from it, so that
   the first thing a reader sees is the brain at a three quarter angle rather
   than square on. */
export const INITIAL_YAW = -0.25 * Math.PI;

function targets(progress: number, baseFactor: number) {
  const p = progress;

  const x =
    mapClamped(p, 0, 1, 3, -4.5) +
    mapClamped(p, 1.25, 1.5, 0.905, 5) -
    mapClamped(p, 2.8, 3, 0.905, 3) +
    mapClamped(p, 3.3, 3.5, 0.905, 6) -
    mapClamped(p, 4.5, 5, 0.905, 4);

  const y =
    mapClamped(p, 2.7, 3, 0, 0.5) -
    mapClamped(p, 3.3, 3.5, 0, 0.5) +
    mapClamped(p, 5.7, 6, 0, 1.75);

  const explode =
    mapClamped(p, 1.1, 2.2, 0, 1) -
    mapClamped(p, 2.8, 3, 0, 1) +
    mapClamped(p, 4.5, 5, 0, 1) -
    mapClamped(p, 5.7, 6, 0, 1);

  const factor =
    baseFactor +
    mapClamped(p, 0, 1, 0, 1) -
    mapClamped(p, 1.25, 1.5, 0, 1) +
    mapClamped(p, 3.3, 3.5, 0, 0.3) -
    mapClamped(p, 5.7, 6, 0, 1);

  const progressTarget =
    mapClamped(p, 2.7, 3, 0, 1) +
    mapClamped(p, 3.3, 3.5, 0, 1) +
    mapClamped(p, 5.7, 6, 0, 1);

  const progress2 =
    mapClamped(p, 0, 1, 0, 1) -
    mapClamped(p, 2.7, 3, 0, 1) +
    mapClamped(p, 3, 3.5, 0, 1);

  const rotationY =
    mapClamped(p, 0, 1, 0, -Math.PI / 2) +
    mapClamped(p, 2.7, 3, 0, Math.PI / 2) +
    mapClamped(p, 3.3, 3.5, 0, Math.PI / 4) -
    mapClamped(p, 4.5, 5, 0, Math.PI * 1.25) +
    mapClamped(p, 5.7, 6, 0, Math.PI);

  const rotationZ =
    mapClamped(p, 2.7, 3, 0, -0.489) + mapClamped(p, 3.3, 3.5, 0, 0.6);

  /* Not from the specification. This is what keeps the cloud from taking the
     contrast ratio of the text laid over it below the accessible floor.

     The opening screen has the brain on the right and the headline on the left,
     so nothing is written over it and it runs at full strength. From the first
     section onwards the page is prose and the cloud is behind it, so it comes
     down. The number is set by measurement rather than by taste: the test that
     enforces it reads the real luminance inside each text element's box. */
  const contentDim = mapClamped(p, 0.55, 1.15, 0, 0.62);

  return {
    offset: { x: BASE.x + x, y: BASE.y + y, z: BASE.z },
    explode: Math.max(0, Math.min(1, explode)),
    factor,
    progress: progressTarget,
    progress2,
    rotation: { x: 0, y: INITIAL_YAW + rotationY, z: rotationZ },
    contentDim,
  } satisfies ParticleTimelineState;
}

function approach(current: number, target: number, ease: number) {
  return current + (target - current) * ease;
}

export class ParticleTimeline {
  private state: ParticleTimelineState;
  private baseFactor: number;

  constructor(baseFactor: number) {
    this.baseFactor = baseFactor;
    /* Started at the resting values rather than at zero, so the first frame is
       the opening composition rather than a cloud easing in from the origin. */
    this.state = targets(0, baseFactor);
  }

  setBaseFactor(value: number) {
    this.baseFactor = value;
  }

  get current(): ParticleTimelineState {
    return this.state;
  }

  update(sectionProgress: number, ease: number) {
    const to = targets(sectionProgress, this.baseFactor);
    const from = this.state;

    this.state = {
      offset: {
        x: approach(from.offset.x, to.offset.x, ease),
        y: approach(from.offset.y, to.offset.y, ease),
        z: approach(from.offset.z, to.offset.z, ease),
      },
      explode: approach(from.explode, to.explode, ease),
      factor: approach(from.factor, to.factor, ease),
      progress: approach(from.progress, to.progress, ease),
      progress2: approach(from.progress2, to.progress2, ease),
      rotation: {
        x: approach(from.rotation.x, to.rotation.x, ease),
        y: approach(from.rotation.y, to.rotation.y, ease),
        z: approach(from.rotation.z, to.rotation.z, ease),
      },
      contentDim: approach(from.contentDim, to.contentDim, ease),
    };
    return this.state;
  }

  /* Used by the reduced motion path and by the tests, which need the settled
     answer for a scroll position without waiting for it to ease there. */
  settle(sectionProgress: number) {
    this.state = targets(sectionProgress, this.baseFactor);
    return this.state;
  }
}
