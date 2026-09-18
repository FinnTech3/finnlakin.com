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
const LANE_FRACTION = 0.36;

function halfViewport(aspect: number) {
  return Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360) * aspect;
}

/* The extent every shape is normalised to, which the factor scales into the
   same world units as the offset: factor times this is the cloud's radius. */
const CLOUD_RADIUS = 0.34;

/* How far the cloud is held down while it is over the column. Set by the
   contrast suite rather than by eye: it walks every run of text on the page and
   reads the pixels actually behind it. */
const PAPER_DIM = 0.96;

/* And on a screen too narrow to have a lane, where the cloud has nowhere to be
   but behind the words. A faint moving presence rather than a picture, which is
   the same answer the old full page layout came to for the same reason. */
const NARROW_PAPER_DIM = 0.88;

function targets(progress: number, baseFactor: number, aspect: number) {
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
  /* A little further right than the reference's three.

     The copy sits in the left of the stage and the cloud in the right, and at
     three they overlapped: the contrast suite reads the brightest pixel behind
     each run of text, and the cloud's glow reached back far enough to put the
     eyebrow on a background of 0.49 in relative luminance.

     Four and a fifth fixed the measurement and broke the picture, which is what
     looking at it rather than at the number is for: it put the cloud under the
     artifact card with half of it off the right edge, and the page lost its
     brain to gain a ratio. What actually buys the contrast is the shade behind
     the copy column, so this only has to clear the column rather than outrun
     the glow. */
  const openX = narrow ? 0 : 3.1;
  /* Opposite directions on the two shapes of screen, and both of them are the
     same rule: the cloud goes where the text is not.

     A phone has no free half, so it goes below the text, and the hero reserves
     the room below the call to action so the reconstruction table is not in the
     same band. At minus two point four its top edge landed on the last line of
     the course paragraph and across the button.

     A wide screen has a free half, but it does not have a free bottom. The
     hero's text column is a fixed number of characters wide, so the wider the
     window the fewer lines it wraps to and the higher the table rides up to
     meet the cloud: tuned at an aspect of 1.6 the cloud sat clear of it, and at
     1.95, which is an ordinary monitor, it sat across the caption and the first
     three rows. Raised by two point seven it sits beside the headline instead,
     about a third of the way down the viewport, clear of the navigation above
     it and the table below. It ramps back to the resting offset by the end of
     the first section either way. */
  /* Held for the whole stage rather than ramped away over the first section:
     the composition that was tuned for the opening is the composition for all
     of it now, because the panel it sits in never moves.

     The narrow value was low enough to put the cloud off the bottom of a phone
     altogether, which is a thing no screenshot of a desktop will ever show and
     which the engine reports as running normally: the frames were identical
     because there was nothing in them. It sits in the lower half of the screen
     now, under the words and above the fold. */
  const openY = narrow ? -1.3 : 2.1;

  /* Which surface the cloud is being drawn on.

     Nought is the dark stage, where the particles are a light accumulated over
     black. One is paper, where the same accumulation is read as ink coverage
     instead. The ramp is the hand-over, and it sits in the last quarter of the
     hero, so the black plate has gone by the time the first paper band arrives.

     This is the number that let the stage stop being the whole timeline. The
     cloud used to have to be gone before the paper started, because additive
     blending on white adds to white and disappears; it does not have to be gone
     now, so the stage is an opening rather than a container and the cloud
     carries on down the page beside the writing.

     Computed here, before the composition, because the composition depends on
     it: the stage and the paper want the cloud in different places. */
  const inkiness = mapClamped(p, 0.72, 0.95, 0, 1);

  /* Whether the page is wide enough to have given the cloud a lane.

     The bands below the stage push their content to one side and leave the
     other for the cloud, and they stop doing it below 1100 pixels, where there
     is no width to give away. The two have to agree: a cloud travelling down a
     lane that the layout has collapsed is a cloud travelling down the middle of
     the reading. An aspect of 1.22 is 1100 by 900, which is that breakpoint. */
  const wide = aspect >= 1.22;

  /* Where the cloud sits.

     This went round a full circle and the record is worth keeping. It began as
     excursions of four to six units, choreographed for a page that scrolled
     past the cloud. The sticky stage made those wrong: the cloud held one place
     on the screen for the whole timeline, so an excursion of four units carried
     it off the edge and left a reader looking at an empty black rectangle for a
     screen and a half. They were cut to a few tenths.

     Now there are two compositions and the ink mixes between them. On the stage
     the cloud sits beside the copy and drifts. On paper it sits in the lane and
     changes sides at the band boundaries, so it is beside the work, across
     during the about band, back for the path, across again, and gathering
     towards the middle for the contact section, where the column is short.

     The lane's centre is not a number here at all. It comes out of the field of
     view, the camera's distance and the share of the screen the bands leave
     empty, so it tracks the layout at every width instead of being right at the
     one the tuning was done on. */
  const half = halfViewport(aspect);
  const laneX = (1 - LANE_FRACTION) * half;

  const stageX =
    openX +
    mapClamped(p, 0, 1, 0, -0.55 * spread) +
    mapClamped(p, 1.2, 1.5, 0, 0.55 * spread);

  /* The crossings finish just before each boundary rather than straddling it.

     Straddled, the cloud was halfway across the screen at the exact moment a
     section's heading arrived at the top of the viewport, which is the one place
     on the page where it is guaranteed to be over something: measured, it sat
     on "Where I have studied and worked" at 42% of full strength. Finished
     early, the cloud is already in the new lane when the heading appears, and
     the crossing itself happens over the tail of the section before, which is
     that section's bottom padding. */
  /* Two crossings on the paper half, not five.

     The sections are laid out in pairs, right, right, left, left, right, right,
     and the reason is in page.tsx: two adjacent sections with opposite lanes
     collide by construction, because they share the viewport for most of a
     scroll through the boundary between them and one of them therefore has its
     content wherever the cloud is. In pairs, four of the five boundaries need no
     crossing at all.

     Each crossing finishes just before the boundary, so the cloud is in the new
     lane by the time the incoming heading reaches the top of the screen. The
     lanes in page.tsx and these two windows are one decision written in two
     files; if one changes the other has to. */
  const laneSide =
    1 - mapClamped(p, 2.6, 2.95, 0, 2) + mapClamped(p, 4.6, 4.95, 0, 2);
  const paperX = wide ? laneX * laneSide : 0;

  const x = stageX + (paperX - stageX) * inkiness;

  /* Vertical drift, and it is small on purpose. The canvas is fixed, so this is
     movement within the viewport rather than down the page: the page supplies
     the travel, and a cloud that also rides up and down the screen reads as two
     motions fighting rather than as one.

     The one large step is the hand-over. The opening composition sits high on
     the stage, beside the headline and clear of the artifact cards below it; on
     paper there are no artifact cards and the cloud drops back to the middle of
     the screen, which is where the lane is. */
  const y =
    openY +
    mapClamped(p, 0.7, 1.1, 0, -1.9) +
    mapClamped(p, 2.7, 3, 0, 0.4) -
    mapClamped(p, 3.3, 3.5, 0, 0.4) +
    mapClamped(p, 5.7, 6, 0, 0.6);

  /* How far apart the cloud is thrown, and it is a quarter of itself on paper.

     The explosion was choreographed against the stage, where nothing is behind
     the cloud and a reader watching it come apart is watching the only thing on
     the screen. On paper it is over a page of writing, and at full strength it
     is not a brain coming apart, it is a spray of ink across two paragraphs:
     the first build of this put a fully dispersed cloud over the whole of the
     deflated-sharpe card. Held down, the same ramps read as the cloud
     breathing, which is what a thing travelling beside the reading should do.

     Scaled rather than removed, because it is still what the morphs are hung
     off: the cloud has to loosen before it can become something else. */
  const burst =
    mapClamped(p, 1.1, 2.2, 0, 1) -
    mapClamped(p, 2.8, 3, 0, 1) +
    mapClamped(p, 4.5, 5, 0, 1) -
    mapClamped(p, 5.7, 6, 0, 1);
  const explode = burst * (1 - 0.74 * inkiness);

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
  const columnClear = (1 - 2 * LANE_FRACTION) * half + CLOUD_RADIUS * baseSize;
  /* Raised to a power below one, so it bites as soon as the cloud starts to
     come in rather than only once it is on top of the words. Linear, the cloud
     was still at 42% of full strength with its middle over a heading, which is
     the arithmetic working exactly as written and the number being wrong. */
  const overColumn = Math.pow(
    1 - clamp(Math.abs(BASE.x + x) / Math.max(0.1, columnClear), 0, 1),
    0.55,
  );
  const contentDim = Math.max(
    narrow ? mapClamped(p, 0.05, 0.3, 0, 0.72) : mapClamped(p, 0, 0.5, 0.1, 0.2),
    /* On paper, and only there. A page with no lane, which is every screen
       under 1100 pixels, has the cloud behind the reading at every scroll
       position, so it is held down the whole way rather than at the crossings
       only. */
    inkiness * (wide ? overColumn * PAPER_DIM : NARROW_PAPER_DIM),
  );

  /* And it shrinks as it crosses, as well as going faint.

     There is no scroll position at which a crossing is over nothing. A section
     one and a half viewports tall has its heading on screen from about six
     tenths of a boundary away, and the band before it is still on screen until
     the boundary itself, so the two overlap and the cloud has to pass through
     one of them. Dimming alone leaves a faint thing the width of a column
     sliding over a serif heading, which reads as a smear; dimming and shrinking
     together make it a small faint thing passing behind the words, which is
     what it is meant to be. Tied to the same overColumn that does the dimming,
     so the two cannot drift apart. */
  const factor = baseSize - overColumn * 1.5 * inkiness;

  return {
    offset: { x: BASE.x + x, y: BASE.y + y, z: BASE.z },
    explode: Math.max(0, Math.min(1, explode)),
    factor,
    progress: progressTarget,
    progress2,
    rotation: { x: 0, y: INITIAL_YAW + rotationY, z: rotationZ },
    contentDim,
    inkiness,
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
    this.state = targets(0, baseFactor, aspect);
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

  update(sectionProgress: number, ease: number, deltaSeconds: number) {
    const to = targets(sectionProgress, this.baseFactor, this.aspect);
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
      inkiness: approach(from.inkiness, to.inkiness, step),
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
      inkiness: 0,
    };
    return this.state;
  }

  /* Used by the reduced motion path and by the tests, which need the settled
     answer for a scroll position without waiting for it to ease there. */
  settle(sectionProgress: number) {
    this.state = targets(sectionProgress, this.baseFactor, this.aspect);
    return this.state;
  }
}
