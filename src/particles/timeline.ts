import { clamp, easeForFrame, mapClamped } from "./pack";
import { CAMERA_FOV, CAMERA_POSITION } from "./renderer";
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

/* Applied on top of the timeline rotation and kept separate from it.

   Eighteen degrees, not forty five. The shape is swept from an outline traced
   off an anatomical plate, and an outline is only an outline from the direction
   it was drawn: measured, the projection is widest at zero yaw and a sixth
   narrower at a quarter turn, where the silhouette that took four attempts to
   get right is foreshortened into an oval. Enough turn to say the cloud is a
   solid, not enough to throw away the view that identifies it. The reference
   shows its own brain at very nearly this angle, for the same reason. */
export const INITIAL_YAW = -0.1 * Math.PI;

/* The lane the cloud travels down on the paper half, derived rather than
   chosen.

   This is the share of the viewport the bands leave empty beside their content,
   and it is --lane in globals.css: the two have to be changed together, which
   is why both say so. Everything else here follows from it and from the camera,
   so the cloud goes where the layout says the gap is at any screen width rather
   than at the one width it was tuned on.

   Half the viewport, in the world units the offset is in, is the distance from
   the camera to the cloud's plane times the tangent of half the field of view,
   times the aspect. The lane's centre then sits (1 - lane) of that out from the
   middle and the content's inner edge at (1 - 2 * lane). */
const LANE_FRACTION = 0.4;

function halfViewport(aspect: number) {
  return Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360) * aspect;
}

/* The extent every shape is normalised to, which the factor scales into the
   same world units as the offset: factor times this is the cloud's radius. */
const CLOUD_RADIUS = 0.34;

/* How much further than its own radius the explosion throws the cloud, at full
   strength. param3.r in targets.ts is 1 + 2.2 * random(), so no particle is
   thrown more than 3.2 times its own distance from the centre; this is a little
   over that, because the particle that draws the largest multiple is not always
   the one that started furthest out and the two compound. Measured against the
   generated cloud by scripts/check-motion.ts, which fails if the reach here
   stops covering the real one. */
const EXPLODE_SPREAD = 4.4;

/* How much of the half frame the composition is allowed to fill. Not one: a
   shape whose outermost particle sits exactly on the edge reads as clipped,
   and the bloom carries five downsample levels past the particles. */
const FRAME_FILL = 0.94;

/* How far past its own particles the cloud is still bright, in world units.

   The bloom runs five downsample levels, so the glow reaches a long way past
   the last speck, and a model of the cloud's width that stops at its particles
   is wrong by exactly that much. Measured by the contrast suite rather than
   reasoned about: with the cloud's centre 4.09 units out and its particles
   ending at 4.22, the tools eyebrow at the edge of the column beside it sat on
   a background of 0.2897, which is the cloud at nearly full strength. The
   dimming had computed that it was clear. */
const BLOOM_REACH = 1.6;

/* How far the cloud is held down while it is over the column. Set by the
   contrast suite rather than by eye: it walks every run of text on the page and
   reads the pixels actually behind it. */
const COLUMN_DIM = 0.94;

/* And on a screen too narrow to have a lane, where the cloud has nowhere to be
   but behind the words. A faint moving presence rather than a picture, which is
   the same answer the old full page layout came to for the same reason. */
const NARROW_DIM = 0.86;

function targets(progress: number, baseFactor: number, aspect: number, laneSide: number) {
  const p = progress;

  /* The reference's numbers are written for a wide screen, where the cloud has
     a right half to sit in and room to travel across. A phone has neither: at
     the specified opening offset of three, measured on a Pixel 5, all but a
     sliver of the brain was off the right edge.

     So the horizontal excursions are scaled by how wide the screen actually is,
     and on a narrow one the opening composition moves below the headline
     instead of beside it, which is where the space is. Everything else in the
     timeline is unchanged. */
  const narrow = aspect < 1.1;
  const spread = Math.min(1, aspect / 1.6);
  /* Where the cloud opens, and it is the lane rather than a number of its own.

     It was 3.1, tuned when the hero's copy was centred in a 1200 pixel measure
     and the cloud had whatever was left of the right hand side. The copy is
     anchored to the left gutter now, so the cloud has the whole right of the
     screen, and starting it where the lane is means the hand-over out of the
     hero is a change of height rather than a slide across.

     It also fixed a contrast failure, which is how it was found: at 3.1 the
     cloud's bloom reached back far enough to put the provenance label on a
     background of 0.0563 and 4.30:1, and the dimming that would have covered
     that would have taken the opening composition down with it. Moving the
     thing that is too close is better than dimming it. */
  const openX = narrow ? 0 : (1 - LANE_FRACTION) * halfViewport(aspect) * 0.92;

  const openY = narrow ? -1.3 : 2.1;

  /* Whether the page is wide enough to have given the cloud a lane.

     The bands push their content to one side and leave the other for the cloud,
     and they stop doing it below 1100 pixels, where there is no width to give
     away. The two have to agree: a cloud travelling down a lane the layout has
     collapsed is a cloud travelling down the middle of the reading. An aspect
     of 1.22 is 1100 by 900, which is that breakpoint. */
  const wide = aspect >= 1.22;

  const half = halfViewport(aspect);
  const laneX = (1 - LANE_FRACTION) * half;

  /* Which lane the cloud is in, handed in rather than worked out.

     It used to be a stack of ramps here, one per band boundary, and it was a
     guess about where each section sits in the progress range. The sections are
     not equal heights, so the guess was wrong: measured at 85% of the document,
     the layout had put its content on the right and the cloud was on the right
     with it. scroll.ts reads the lane off the band's own class now, so there is
     one statement of which side each band uses and the cloud and the layout
     cannot disagree about it. */
  const x = wide
    ? openX + mapClamped(p, 0.55, 1, 0, laneX - openX) + (laneSide - 1) * laneX
    : openX + mapClamped(p, 0, 1, 0, -0.55 * spread);

  /* Vertical drift, and it is small on purpose. The canvas is fixed, so this is
     movement within the viewport rather than down the page: the page supplies
     the travel, and a cloud that also rides up and down the screen reads as two
     motions fighting rather than as one.

     The one large step is the hand-over out of the hero, where the opening
     composition sits high beside the headline and the lane sits at the middle
     of the screen. */
  const y =
    openY +
    mapClamped(p, 0.55, 1, 0, -1.9) +
    mapClamped(p, 2.7, 3, 0, 0.4) -
    mapClamped(p, 3.3, 3.5, 0, 0.4) +
    mapClamped(p, 5.7, 6, 0, 0.6);

  const burst =
    mapClamped(p, 1.1, 2.2, 0, 1) -
    mapClamped(p, 2.8, 3, 0, 1) +
    mapClamped(p, 4.5, 5, 0, 1) -
    mapClamped(p, 5.7, 6, 0, 1);
  /* Held to two thirds of what the stage plays. The burst was choreographed
     against a screen with nothing else on it; down the page it is behind a
     column of writing, and a fully dispersed cloud there is not a brain coming
     apart, it is a haze across two paragraphs. */
  const explode = burst * (1 - 0.34 * mapClamped(p, 0.8, 1.2, 0, 1));

  /* How large the cloud is drawn, and it now falls as the cloud comes apart.

     The explosion scatters each particle by a distance proportional to this,
     so at a constant factor a fully dispersed cloud is several times the width
     of the screen and a reader is not watching it break up, they are flying
     through the middle of it: individual tetrahedra a hundred pixels across
     drifting past, with no shape to read at all. That was survivable while the
     cloud was also travelling off to one side, and it is not now that the
     stage holds it in one place.

     Tying it to the same explode value that causes the problem keeps the two
     in step by construction, rather than by two ramps that have to be kept
     lined up by hand. The dispersed cloud ends up about the size of the whole
     brain, which is what makes it read as the brain having come apart. */
  const baseSize =
    baseFactor +
    mapClamped(p, 0, 1, 0, 0.5) -
    Math.max(0, Math.min(1, explode)) * 1.9 +
    mapClamped(p, 3.3, 3.5, 0, 0.3);

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

  /* Not from the specification, and the least glamorous number in this file.

     In the opening screen the cloud has the right half of the page and the
     headline has the left, so nothing is written over it and it runs at full
     strength. The moment it starts travelling left it crosses the text, and a
     bright particle behind a paragraph is not a stylistic question: for the
     quietest grey on this site to clear AA, the brightest pixel behind it has
     to stay under a relative luminance of about 0.033, and the cloud at full
     strength was measured at 0.87 behind a line of body copy.

     So it goes nearly dark before it arrives, and spends the rest of the page
     as a faint moving presence rather than a picture. That is a real cost and
     it is the right way round: the choreography is decoration, and the words
     are the reason anybody is here. The ramp finishes before the cloud reaches
     the text rather than while it is crossing it, and the number at the end is
     set by the measurement, not by eye. */
  /* Finished sooner on a narrow screen. The ramp is measured against how far
     the reader has to scroll before text is over the cloud, and that distance
     is much shorter on a phone: the hero's own table is under the cloud's band
     within a couple of hundred pixels, where on a wide screen the cloud is
     still in the half the text does not use. */
  /* How far the cloud is turned down once text is over it.

     This was a ramp to 0.988 finishing within the first third of a section,
     which is to say the cloud spent the entire page at roughly a hundredth of
     its brightness. That was the right answer for the layout it was written
     for, where the cloud travelled down the page behind two thousand words of
     body copy and a paragraph over it at full strength measured 0.87 in
     relative luminance against the 0.033 the quietest grey needs.

     The stage has no text over the cloud. The copy sits in the left half and
     the cloud in the right; the two artifacts on top of it are opaque white
     cards, which a cloud behind cannot affect at all. So the ramp comes almost
     all the way off, and what is left is for the narrow layout, where the copy
     is above the cloud rather than beside it and a tall phone can still put a
     line of the standfirst across the top of it.

     Measured, not assumed: the contrast suite walks every run of text on the
     page and reads the pixels actually behind it. */
  /* How far the cloud is turned down so that text laid over it keeps its
     contrast ratio.

     On the stage this is a ramp against the scroll, and it is nearly nothing on
     a wide screen: the copy sits in the left half and the cloud in the right,
     and the words carry their own shade. See stage-copy in globals.css.

     On paper it is a ramp against the cloud's own position instead, which is
     the part worth reading twice. The cloud is over the column exactly when its
     offset is near nought, so the protection is computed from the composition
     rather than from a second set of ramps lined up against it by hand. Two
     independent ramps drift the moment either is retuned, and the failure is
     silent: the cloud simply starts crossing the text at full strength one
     tuning session later. */
  /* Where the reading starts, plus the cloud's own radius: the point on the way
     in at which the two begin to overlap. Derived from the layout and from the
     factor rather than being a number of its own, so it cannot go stale when
     either of them changes. */
  const columnClear =
    (1 - 2 * LANE_FRACTION) * half + CLOUD_RADIUS * baseSize + BLOOM_REACH;
  /* Raised to a power below one, so it bites as soon as the cloud starts to
     come in rather than only once it is on top of the words. Linear, the cloud
     was still at 42% of full strength with its middle over a heading, which is
     the arithmetic working exactly as written and the number being wrong. */
  const overColumn = Math.pow(
    1 - clamp(Math.abs(BASE.x + x) / Math.max(0.1, columnClear), 0, 1),
    0.55,
  );
  const contentDim = Math.max(
    narrow ? mapClamped(p, 0.05, 0.3, 0, 0.72) : 0.08,
    /* On a screen with no lane, which is everything under 1100 pixels, the
       cloud is behind the reading at every scroll position rather than at the
       crossings only, so it is held down the whole way. */
    wide ? overColumn * COLUMN_DIM : NARROW_DIM,
  );

  /* And it shrinks as it crosses, as well as going faint. Tied to the same
     overColumn that does the dimming, so the two cannot drift apart. */
  /* Smaller once the hero is behind, and that is a composition decision as much
     as a contrast one. The opening shows the cloud at full size because it is
     the subject; down the page it is travelling beside the writing and it is a
     companion. It also has to fit: measured on a 1280 pixel screen the cloud is
     about 310 pixels across at the opening factor, and a lane of four tenths of
     the viewport is 512, so at full size its bloom crossed into the column
     however far out the lane put it. */
  const crossed =
    (baseSize - overColumn * 1.2) * (1 - 0.18 * mapClamped(p, 0.75, 1.15, 0, 1));

  /* Then the whole composition is pulled in until it fits the frame.

     This is a guarantee rather than a tuning. The choreography is a stack of
     ramps and the explosion multiplies each particle's distance from the centre,
     so the reach at any given scroll position is not something anybody is
     holding in their head: measured, the cloud was reaching 1.74 times the half
     width of the screen during the burst before the contact section, and the
     helix went off the bottom as well. Every previous attempt to keep it in
     frame was a number somewhere else being nudged until one screen width
     looked right.

     Scaling the offset and the size together is a uniform zoom out, so the
     composition keeps its shape and its place in the lane; only its size on the
     screen changes, and only when it would otherwise be clipped. */
  const burstReach = 1 + explode * EXPLODE_SPREAD;
  const radius = CLOUD_RADIUS * crossed * burstReach;
  const roomX = half * FRAME_FILL;
  const roomY = (half / aspect) * FRAME_FILL;
  const overflow = Math.max(
    (Math.abs(x) + radius) / Math.max(0.001, roomX),
    (Math.abs(BASE.y + y) + radius) / Math.max(0.001, roomY),
  );
  const fit = overflow > 1 ? 1 / overflow : 1;
  const factor = crossed * fit;

  return {
    offset: { x: (BASE.x + x) * fit, y: (BASE.y + y) * fit, z: BASE.z },
    explode: Math.max(0, Math.min(1, explode)),
    factor,
    progress: progressTarget,
    progress2,
    rotation: { x: 0, y: INITIAL_YAW + rotationY, z: rotationZ },
    contentDim,
    laneSide: wide ? laneSide : 0,
  } satisfies ParticleTimelineState;
}

function approach(current: number, target: number, ease: number) {
  return current + (target - current) * ease;
}

export class ParticleTimeline {
  private state: ParticleTimelineState;
  private baseFactor: number;
  private aspect: number;

  constructor(baseFactor: number, aspect: number) {
    this.baseFactor = baseFactor;
    this.aspect = aspect;
    /* Started at the resting values rather than at zero, so the first frame is
       the opening composition rather than a cloud easing in from the origin. */
    this.state = targets(0, baseFactor, aspect, 1);
  }

  setBaseFactor(value: number) {
    this.baseFactor = value;
  }

  setAspect(value: number) {
    this.aspect = value;
  }

  get current(): ParticleTimelineState {
    return this.state;
  }

  update(sectionProgress: number, ease: number, deltaSeconds: number, laneSide = 1) {
    const to = targets(sectionProgress, this.baseFactor, this.aspect, laneSide);
    const from = this.state;
    const step = easeForFrame(ease, deltaSeconds);

    this.state = {
      offset: {
        x: approach(from.offset.x, to.offset.x, step),
        y: approach(from.offset.y, to.offset.y, step),
        z: approach(from.offset.z, to.offset.z, step),
      },
      explode: approach(from.explode, to.explode, step),
      factor: approach(from.factor, to.factor, step),
      progress: approach(from.progress, to.progress, step),
      progress2: approach(from.progress2, to.progress2, step),
      rotation: {
        x: approach(from.rotation.x, to.rotation.x, step),
        y: approach(from.rotation.y, to.rotation.y, step),
        z: approach(from.rotation.z, to.rotation.z, step),
      },
      contentDim: approach(from.contentDim, to.contentDim, step),
      laneSide: approach(from.laneSide, to.laneSide, step),
    };
    return this.state;
  }

  /* Pins the composition while the opening animation owns the screen.

     Held rather than overridden at the point of use, so that when the hold is
     released the easing carries the cloud from wherever the intro left it to
     wherever the scroll position says it belongs. Overridden instead, the
     handover would be a jump. */
  hold(offset: { x: number; y: number; z: number }, factor: number, yaw: number) {
    this.state = {
      ...this.state,
      offset,
      factor,
      explode: 0,
      progress2: 0,
      rotation: { x: 0, y: yaw, z: 0 },
      contentDim: 0,
      laneSide: this.state.laneSide,
    };
    return this.state;
  }

  /* Used by the reduced motion path and by the tests, which need the settled
     answer for a scroll position without waiting for it to ease there. */
  settle(sectionProgress: number, laneSide = 1) {
    this.state = targets(sectionProgress, this.baseFactor, this.aspect, laneSide);
    return this.state;
  }
}
