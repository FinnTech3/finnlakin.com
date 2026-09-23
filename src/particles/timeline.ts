import { clamp, easeForFrame, mapClamped } from "./pack";
import { CAMERA_FOV, CAMERA_POSITION } from "./renderer";
import type { CloudMask, LaneState, ParticleTimelineState } from "./types";

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

/* Half the viewport measured up and down rather than across, which is what the
   seam between two sections has to be converted into. */
function halfViewportHeight() {
  return Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360);
}

/* How small the cloud draws itself in while it changes columns.

   This is the whole reason a crossing is possible at all. The cloud at reading
   size is wider than the gap between two sections, so at full size there is no
   route across the page that is not through a paragraph. Contracted it fits the
   seam, and it reads as the thing gathering itself up to move rather than as a
   picture sliding sideways behind the text. */
const CROSS_CONTRACT = 0.55;

/* A hard ceiling on the strip the crossing opens, as a fraction of the screen.

   The cloud's own contracted size decides the strip, so this only bites if a
   retuning makes the cloud large enough to want more room than the layout's
   section padding actually leaves. It is a guard against that, not a setting:
   if it ever binds, the contraction is wrong rather than this number. */
const GAP_HALF_MAX = 0.2;

/* The softening at the column boundary, measured *into* the cloud's own column.
   One sided on purpose: a ramp that ran the other way would be a feather made
   of light lying across the first characters of every line. */
const MASK_FEATHER = 0.045;

/* The default for the callers that have no page to read a lane off: the tests,
   the reduced motion path, and the first frame before the sections are
   measured. The right column, settled, not crossing. */
const SETTLED_RIGHT: LaneState = { from: 1, to: 1, amount: 0, gapUv: 0.5 };

function targets(progress: number, baseFactor: number, aspect: number, lane: LaneState) {
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
  /* How far through a change of columns, eased, and how high that lifts the
     cloud onto the seam. `ride` is nought at both ends of a crossing and one in
     the middle of it, so everything it drives returns to where it was. */
  const amount = clamp(lane.amount, 0, 1);
  const eased =
    amount < 0.5 ? 2 * amount * amount : 1 - Math.pow(-2 * amount + 2, 2) / 2;
  const ride = Math.pow(Math.sin(Math.PI * amount), 0.7);
  const sweep = lane.from + (lane.to - lane.from) * eased;

  const x = wide
    ? openX + mapClamped(p, 0.55, 1, 0, laneX - openX) + (sweep - 1) * laneX
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
  /* Nothing is dimmed any more, and that is the change.

     Three separate things used to hold the cloud down so that text laid over it
     kept its contrast ratio: a ramp against the scroll, a ramp against the
     cloud's own distance from the column, and a black gradient painted over the
     reading in CSS. All three worked, in that the measurement passed. All three
     had the same cost, and it is the fault that was reported: the brain lost
     brightness on whichever side the words were, so it visibly went dim every
     time it changed columns.

     The light is cut now rather than turned down. The final pass masks the
     composited cloud to the column the layout leaves empty for it, so it never
     reaches a word and there is nothing left to protect against. Both columns
     run at the same brightness because neither is being compensated for, and
     the bloom is inside the cut rather than outside it, which is the part no
     amount of dimming could do.

     What the timeline still owes the mask is where to cut. That is the rest of
     this function. */
  const halfH = halfViewportHeight();

  /* Smaller once the hero is behind, and that is a composition decision as much
     as anything: the opening shows the cloud at full size because it is the
     subject, and down the page it is travelling beside the writing and is a
     companion to it. */
  const settled = baseSize * (1 - 0.18 * mapClamped(p, 0.75, 1.15, 0, 1));

  /* And smaller again while it is changing columns.

     The cloud at reading size is wider than the space between two sections, so
     at full size there is no route across this page that is not through a
     paragraph. Drawing itself in is what makes the seam passable, and it is
     also the better picture: the thing gathers itself up, crosses, and opens
     out again, rather than sliding sideways behind the words. */
  const crossed = settled * (1 - CROSS_CONTRACT * ride);

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
  /* The cloud leaves its column to cross, which means going to where the seam
     between the two sections currently is on the screen. `ride` returns to
     nought at both ends, so the cloud is back at its own drift height by the
     time it is in either column. */
  const gapWorldY = (lane.gapUv - 0.5) * 2 * halfH;
  const ridden = wide ? y * (1 - ride) + (gapWorldY - BASE.y) * ride : y;

  const burstReach = 1 + explode * EXPLODE_SPREAD;
  const radius = CLOUD_RADIUS * crossed * burstReach;
  const roomX = half * FRAME_FILL;
  const roomY = (half / aspect) * FRAME_FILL;
  const overflow = Math.max(
    (Math.abs(x) + radius) / Math.max(0.001, roomX),
    (Math.abs(BASE.y + ridden) + radius) / Math.max(0.001, roomY),
  );
  const fit = overflow > 1 ? 1 / overflow : 1;
  const factor = crossed * fit;

  /* Where the final pass is allowed to draw what all of the above produced.

     The column is snapped rather than blended. A lane number halfway between
     two columns describes a boundary in the middle of the screen, which is
     exactly where the reading is; the cloud is never there, because when it is
     between columns it is on the seam and the strip is what is carrying it. The
     snap happens at the midpoint of the crossing, by which time the cloud is
     well inside the strip and the column term is not holding anything. */
  const side = amount < 0.5 ? lane.from : lane.to;

  /* The strip is the size of the thing going through it, not a number picked to
     look right: the contracted cloud plus the distance its bloom carries. Sized
     any smaller and the crossing is clipped; any larger and it is a window onto
     the paragraphs above and below the seam. */
  const crossingReach = CLOUD_RADIUS * factor * burstReach + BLOOM_REACH;

  const mask: CloudMask = {
    edge: 0.5 + side * (0.5 - LANE_FRACTION),
    side: wide ? side : 0,
    feather: MASK_FEATHER,
    gapCentre: lane.gapUv,
    gapHalf: wide && ride > 0.001
      ? Math.min(GAP_HALF_MAX, crossingReach / (2 * halfH))
      : 0,
    off: !wide,
  };

  return {
    offset: { x: (BASE.x + x) * fit, y: (BASE.y + ridden) * fit, z: BASE.z },
    explode: Math.max(0, Math.min(1, explode)),
    factor,
    progress: progressTarget,
    progress2,
    rotation: { x: 0, y: INITIAL_YAW + rotationY, z: rotationZ },
    mask,
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
    this.state = targets(0, baseFactor, aspect, SETTLED_RIGHT);
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

  update(
    sectionProgress: number,
    ease: number,
    deltaSeconds: number,
    lane: LaneState = SETTLED_RIGHT,
  ) {
    const to = targets(sectionProgress, this.baseFactor, this.aspect, lane);
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
      /* Taken whole rather than eased towards, unlike everything above it.

         The mask is a statement about where the page's words are, and the page
         does not ease into having words somewhere. Easing the boundary would
         put it briefly between two columns, which is the middle of the screen,
         which is the reading. The one discontinuity in it, the snap from one
         column to the other, happens while the cloud is inside the seam strip
         and is therefore invisible. */
      mask: to.mask,
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
      /* And no keep-out while the opening runs.

         The entrance flies in from all four edges of the frame and converges,
         so a column mask deletes three quarters of it: measured, the whole
         frame at three tenths of a second fell from the 0.0015 the test
         requires to 0.00125, which is the animation being cut rather than the
         animation being dim.

         It is also the right answer rather than a concession to a test. The
         mask exists to keep the cloud off the reading, and during the opening
         there is no reading: the copy has not settled, nothing is being
         scrolled, and the entrance is the subject of the screen rather than
         something beside it. The keep-out starts when the page does. */
      mask: { ...this.state.mask, off: true },
    };
    return this.state;
  }

  /* Used by the reduced motion path and by the tests, which need the settled
     answer for a scroll position without waiting for it to ease there. */
  settle(sectionProgress: number, lane: LaneState = SETTLED_RIGHT) {
    this.state = targets(sectionProgress, this.baseFactor, this.aspect, lane);
    return this.state;
  }
}
