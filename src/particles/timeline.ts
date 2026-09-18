import { easeForFrame, mapClamped } from "./pack";
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

  /* Where the cloud sits, and this is the number the stage changed most.

     The excursions here used to be enormous, four to six units at a time, and
     they were correct for the layout they were written for: the cloud
     travelled down a page of seven sections, crossing from one side to the
     other so it was never behind the paragraph a reader was on. The page it
     travelled down does not exist any more. The stage is sticky, so the cloud
     holds one place on the screen for the whole of the timeline, and an
     excursion of four units now simply carries it off the edge and leaves a
     reader looking at an empty black rectangle for a screen and a half of
     scrolling, which is exactly what it did.

     So the cloud stays where it was put and drifts. The choreography is
     carried by what it does rather than by where it goes: it settles, breaks
     apart, reforms as the data field, unwinds into the helix and gathers back
     into a brain, all of it in the same corner of the screen. That is also the
     more legible version of the idea. A shape that stays still while it
     changes can be watched; one that changes while crossing the screen cannot
     be. */
  const x =
    openX +
    mapClamped(p, 0, 1, 0, -0.55 * spread) +
    mapClamped(p, 1.25, 1.5, 0, 0.7 * spread) -
    mapClamped(p, 2.8, 3, 0, 0.5 * spread) +
    mapClamped(p, 3.3, 3.5, 0, 0.8 * spread) -
    mapClamped(p, 4.5, 5, 0, 0.45 * spread);

  const y =
    openY +
    mapClamped(p, 2.7, 3, 0, 0.4) -
    mapClamped(p, 3.3, 3.5, 0, 0.4) +
    mapClamped(p, 5.7, 6, 0, 0.6);

  const explode =
    mapClamped(p, 1.1, 2.2, 0, 1) -
    mapClamped(p, 2.8, 3, 0, 1) +
    mapClamped(p, 4.5, 5, 0, 1) -
    mapClamped(p, 5.7, 6, 0, 1);

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
  const factor =
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
  const contentDim = Math.max(
    /* Barely anything on a wide screen, and that is the point of the stage.

       Dimming the whole cloud to protect the words was the old layout's
       answer, and it ramped to 0.988: a hundredth of full strength, for the
       whole page, because there the cloud really did travel behind two
       thousand words. Chasing it here went the same way. Moving the cloud right
       took the headline's background from 0.49 to 0.38 and stopped, because the
       bloom carries five downsample levels past the particles; dimming to 0.42
       cleared the headline and the failure simply moved to the 15px grey line
       under it, which needs its background under 0.183 even in pure white type.

       So the words carry their own shade instead, in a gradient behind the copy
       column only, and the cloud keeps its half of the stage at full strength.
       See stage-copy in globals.css. */
    narrow ? mapClamped(p, 0.05, 0.3, 0, 0.72) : mapClamped(p, 0, 0.5, 0.1, 0.2),
    /* And the cloud takes itself out at the end of the stage, before the paper
       starts. It has to go: additive blending on white adds to white, so a
       cloud left running over the sections below is a faint grey haze over the
       whole editorial half of the page.

       Done here rather than by fading the canvas element in CSS, which is where
       it was. That fade rode the stage's own view timeline, and a view timeline
       whose subject is not being rendered is inactive: anything that hid the
       page took the cloud to nothing with it, including the three tests that
       hide the page precisely so they can photograph what is behind the
       words. */
    mapClamped(p, 5.4, 6, 0, 1),
  );

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
