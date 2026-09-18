/* The engine's public vocabulary. Everything a caller can set, and everything
   the timeline hands to the renderer, is named here so that no other file has
   to describe the shape of it a second time. */

export type QualityLevel = "high" | "medium" | "low";

/* What the post chain runs at each level, from the specification's own split.
   Bokeh is the expensive one and it is desktop-and-high only. */
export type PostLevel = "full" | "bloom" | "minimal";

export type ParticleBrainConfig = {
  particleCount: number;
  /* The logical particle grid is square and its side is this. The simulation
     textures are twice this on each axis, because they carry four target
     quadrants. */
  gridSize: number;
  factorDesktop: number;
  factorMobile: number;
  particleScaleDesktop: number;
  particleScaleMobile: number;
  spring: number;
  friction: number;
  /* How much of the opening reveal one particle's own arrival occupies. The
     rest of the reveal is the stagger: the smaller this is, the longer the
     queue and the more the cloud streams in rather than landing together. */
  entryWindow: number;
  morphDelayDesktop: number;
  morphDelayMobile: number;
  secondaryMorphDelay: number;
  explosionDelay: number;
  /* How far the parting reaches, in the simulation's own nought to one
     space, and how hard it pushes. */
  pointerReach: number;
  pointerPush: number;
  pointerSwirl: number;
  mouseSmoothing: number;
  scrollEase: number;
  timelineEase: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignetteOffset: number;
  vignetteDarkness: number;
  grainStrength: number;
  noiseAmplitude: number;
  colourFactor: number;
};

/* Reference values, taken from the specification rather than invented. Where it
   named a number, that number is here. Where it named a range, the middle of
   the range is here and the comment says so. */
export const DEFAULTS: ParticleBrainConfig = {
  particleCount: 10000,
  gridSize: 100,
  factorDesktop: 4.35,
  /* Down from 2.5. The cloud has to fit between the call to action and a
     little past the bottom of a phone's viewport, and at 2.5 it was half a
     screen tall and sat across the hero's text. */
  factorMobile: 2.05,
  /* Smaller than they were, and that is what makes the folds visible.

     At 1.55 the pyramids overlapped enough that the cortex accumulated to white
     in the middle and the gyral bands only read around the rim. The reference
     this is measured against has thousands of distinct triangles: you can see
     the individual shapes, and the structure is in the gaps between them. That
     is a size decision, not a brightness one, though the bloom below had to
     come down with it. */
  particleScaleDesktop: 1.08,
  particleScaleMobile: 0.92,
  spring: 0.006,
  friction: 0.892,
  /* An eighth, which is a little over a tenth of a second: nearly a step rather
     than a ramp, and the queue in front of a particle is most of the reveal.

     This was three tenths, and the cost was measured rather than felt. The ramp
     is eased at both ends, so over three tenths of a second the spring was still
     almost nothing a fifth of a second in, and the first particle did not cross
     into the frame until about six hundred milliseconds: over half a second of
     black at the start of a page load. Made nearly a step, a particle sets off
     at once and is inside the frame by about a fifth of a second, which is the
     drama that was being waited for. There is no jerk from switching a spring
     on: the force is proportional to distance, so the particle accelerates from
     rest whatever the gate does. */
  entryWindow: 0.12,
  morphDelayDesktop: 0.0005,
  morphDelayMobile: 0.000025,
  secondaryMorphDelay: 0.0005,
  explosionDelay: 0.00015,
  /* A reach of 0.13 is about two fifths of the cloud's radius, so the hole is
     local rather than the whole brain moving. The push is set against the
     spring: a particle settles where the two balance, which at these values is
     roughly a third of the radius out of place. */
  /* Tuned by looking at it, against a sweep. A reach of 0.18 is a little over
     half the cloud's radius, so the hole is local and the brain keeps its
     shape. The push is set against the spring, which is what closes the hole
     again: a particle settles where the two balance. The first values here were
     a fifth of these and the parting was real but almost invisible. */
  pointerReach: 0.18,
  pointerPush: 0.003,
  pointerSwirl: 0.0017,
  mouseSmoothing: 0.1,
  scrollEase: 0.075,
  timelineEase: 0.1,
  /* The bloom was carrying the cortex to white on its own. Raising the
     threshold means only the genuinely bright particles glow rather than the
     whole mass, so the halo stays and the surface keeps its structure. */
  bloomStrength: 0.3,
  bloomThreshold: 0.34,
  bloomRadius: 1,
  vignetteOffset: 0.3,
  vignetteDarkness: 4,
  /* Down from a thirtieth, which was visibly noisy across the whole frame.
     The specification asks for grain that cannot be pointed at. */
  grainStrength: 0.006,
  noiseAmplitude: 0.619,
  colourFactor: 1.3,
};

/* Everything the timeline produces and the renderer consumes. Each of these is
   interpolated towards its target rather than set from scroll directly, which
   is what makes scrolling backwards reverse the animation instead of jumping
   it. */
export type ParticleTimelineState = {
  /* Where the whole cloud sits in world space. */
  offset: { x: number; y: number; z: number };
  /* How far apart the particles are pushed from their own centre. */
  explode: number;
  /* The radius the normalised target positions are multiplied up by. */
  factor: number;
  /* Zero through three, walking the four target quadrants. */
  progress: number;
  /* A second progress the depth and post effects follow. */
  progress2: number;
  rotation: { x: number; y: number; z: number };
  /* How far the cloud's brightness is pulled down so that text laid over it
     keeps its contrast ratio. Zero is full strength. */
  contentDim: number;
};

export type MouseState = {
  /* Minus one through one, about the centre of the viewport. */
  current: { x: number; y: number };
  target: { x: number; y: number };
  /* How fast the pointer moved, smoothed and clamped. */
  delta: { x: number; y: number };
  inside: boolean;
};

export type ScrollState = {
  /* Zero through six. Six sections of timeline, seven sections of page. */
  sectionProgress: number;
  target: number;
};

export type ParticleBrain = {
  setQuality: (level: QualityLevel) => void;
  /* Pointer position in client coordinates. Stored by the engine and read once
     a frame, never acted on per event. */
  pointer: (clientX: number, clientY: number) => void;
  pointerLeave: () => void;
  /* Ends the opening animation now. Nobody should have to wait out a
     decoration to read a page. */
  endIntro: () => void;
  setConfig: (config: Partial<ParticleBrainConfig>) => void;
  resize: () => void;
  /* One frame. The host owns the loop, because the host is what knows about
     visibility, reduced motion and whether the element is on screen. */
  frame: (nowMs: number) => void;
  dispose: () => void;
  /* For the tests and the debug overlay, never for the page. */
  inspect: () => {
    quality: QualityLevel;
    instances: number;
    frameMs: number;
    timeline: ParticleTimelineState;
    /* Where the parting is happening, in the simulation's own space, and how
       open it is. Only ever read by the debug overlay and the tests. */
    pointer: [number, number, number];
    pointerActive: number;
    /* Where the page is, in sections, as the timeline sees it. Exposed so the
       tests can assert the boundaries are the real ones: section n's top at the
       top of the viewport has to read exactly n, and it does not if the
       measurement was taken before the fonts moved everything. */
    scroll: number;
    /* Milliseconds of the engine's own clock since its first frame, which is
       what the opening reveal is measured against. Exposed because it is the
       only way for a test to know the animation has reached a moment: the wall
       clock and the engine's clock are the same thing only on a machine that is
       keeping up, and the one this is asserted on is not. */
    since: number;
  };
};
