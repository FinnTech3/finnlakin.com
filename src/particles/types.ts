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
  morphDelayDesktop: number;
  morphDelayMobile: number;
  secondaryMorphDelay: number;
  explosionDelay: number;
  mouseStrength: number;
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
  factorMobile: 2.5,
  particleScaleDesktop: 1.55,
  particleScaleMobile: 1.2,
  spring: 0.006,
  friction: 0.892,
  morphDelayDesktop: 0.0005,
  morphDelayMobile: 0.000025,
  secondaryMorphDelay: 0.0005,
  explosionDelay: 0.00015,
  mouseStrength: 1,
  mouseSmoothing: 0.1,
  scrollEase: 0.075,
  timelineEase: 0.1,
  bloomStrength: 0.4,
  bloomThreshold: 0.159,
  bloomRadius: 1,
  vignetteOffset: 0.3,
  vignetteDarkness: 4,
  grainStrength: 0.035,
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
  };
};
