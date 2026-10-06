/* The engine's public vocabulary. Everything a caller can set, and everything
   the timeline hands to the renderer, is named here so that no other file has
   to describe the shape of it a second time. */

export type QualityLevel = "high" | "medium" | "low";

/* What the post chain runs at each level, from the specification's own split.
   Bokeh is the expensive one and it is desktop-and-high only. */
export type PostLevel = "full" | "bloom" | "minimal";

export type ParticleBrainConfig = {
  /* The logical particle grid is square and its side is this. The simulation
     textures are twice this on each axis, because they carry four target
     quadrants. */
  gridSize: number;
  gridSizeMobile: number;
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
  /* What the cloud is drawn in. See CloudSurface. */
  surface: CloudSurface;
};

/* The medium the final pass draws the cloud in.

   The particles accumulate additively, which is the only way to draw thirty
   thousand overlapping shards without sorting them, and an accumulation of
   light can only be seen over something dark. That is a fact about the
   arithmetic and not a preference: over a pale page the same buffer adds to
   white and the cloud is not there.

   So the buffer is read differently per surface. "light" is the accumulation
   as light, which needs a dark page under it. The other two read the same
   numbers as how much ink has been laid down, which is what a pale page needs,
   and lay pigment rather than emit light. Every colour here is a display
   colour, written the way a person picks it. */
export type CloudSurface =
  | { kind: "light" }
  /* One pigment on any page. `pale` is a thin laydown and `deep` a heavy one,
     `gain` how fast the sheet saturates. Dark pigments read as a drawing on
     paper; pale ones on a mid grey page read as chalk. */
  | { kind: "ink"; pale: string; deep: string; gain: number }
  /* Two pigments, printed one after the other with the second a little out of
     register and both screened, which is what a risograph does and what gives
     it its character. `paper` must be the page's own colour: two inks over one
     another are filters rather than lights, so what the second one filters is
     the first one over the sheet. */
  | {
      kind: "riso";
      paper: string;
      inkA: string;
      inkB: string;
      gain: number;
      /* How far the second plate misses, in uv. */
      offset: readonly [number, number];
      /* The screen's cell in device pixels, and how deeply it bites. */
      cell: number;
      depth: number;
    };

/* Reference values, taken from the specification rather than invented. Where it
   named a number, that number is here. Where it named a range, the middle of
   the range is here and the comment says so. */
export const DEFAULTS: ParticleBrainConfig = {
  /* A hundred and fifty on a side, up from a hundred.

     Measured rather than felt: over the brain's own bounding box in a rendered
     frame at two thousand pixels wide, ten thousand particles put colour on
     22.4% of it and left the other three quarters black. A cortex cannot read
     as a surface out of that, whatever the folds underneath are doing, and it
     is why the corrugation showed in a flat point plot of the same data and
     disappeared the moment the engine drew it. Twenty two and a half thousand
     is the same cloud at a bit over twice the density.

     The cost is about a hundred and fifty milliseconds more of sampling at
     startup, which happens behind the intro, and two and a quarter times the
     instances, which is nothing on a desktop GPU. A phone builds a smaller
     cloud rather than paying for particles its tier will not draw. */
  gridSize: 180,
  gridSizeMobile: 120,
  factorDesktop: 5.15,
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
  /* How far the pointer reaches, in the space the shapes are built in, where
     the cloud's furthest particle sits at 0.34.

     So 0.18, which is what this was, is 53% of the cloud's radius: over half
     the brain moved for every twitch of the mouse, and a comment here claimed
     that was local. It was measured against the wrong thing. Two fifths and a
     half of a radius are both most of a brain.

     0.055 is a sixth of the radius, which on a cloud drawn at the opening
     composition is a dimple a little wider than a fingertip. The falloff is
     sharpened as well, because the smoothstep the shader uses is broad by
     construction and trails influence out to the full reach: squared, the
     displacement concentrates near the pointer and the far edge of the reach
     barely moves at all. The push comes down with it, so the particles that are
     touched move less as well as fewer of them being touched.

     Counted rather than judged, by scripts/check-brain-targets.ts: at the
     densest place a pointer can be put, a reach of 0.18 had 47.4% of the cloud
     inside it, 0.13 had 19.6%, 0.055 had 3.0% and this has about 9%.

     0.055 went too far the other way. It answered the complaint exactly, and a
     dimple a fingertip wide in a cloud four hundred pixels across is something
     a reader never finds. What was actually wrong was that the old version
     moved *most of the brain*, not that it moved a lot of it, so the area stays
     small and the force inside that area goes up rather than down. The push and
     the swirl are both roughly doubled, and the shader scales them again by how
     fast the pointer is moving, which is the lever that was sitting unused: a
     resting cursor opens its hole at the base amount and a swept one drags a
     wake three times the size. */
  pointerReach: 0.085,
  pointerPush: 0.0052,
  pointerSwirl: 0.0041,
  mouseSmoothing: 0.1,
  scrollEase: 0.075,
  timelineEase: 0.1,
  /* The bloom was carrying the cortex to white on its own. Raising the
     threshold means only the genuinely bright particles glow rather than the
     whole mass, so the halo stays and the surface keeps its structure.

     Raised again with the density. The particles are drawn additively, so a
     cloud with two and a quarter times as many of them accumulates two and a
     quarter times the energy wherever they overlap, and at 0.42 the whole
     parietal region went over the threshold and bloomed into a single white
     field: measured over the brain's bounding box, near white pixels went from
     1.0% of it to 4.1% and took the gyri in the top half with them. */
  bloomStrength: 0.2,
  bloomThreshold: 0.68,
  bloomRadius: 0.75,
  vignetteOffset: 0.3,
  vignetteDarkness: 4,
  /* Down from a thirtieth, which was visibly noisy across the whole frame.
     The specification asks for grain that cannot be pointed at. */
  grainStrength: 0.006,
  noiseAmplitude: 0.619,
  /* Down from 1.3, by the same arithmetic as the bloom threshold above: the
     cloud got denser, so each particle has to be dimmer for the mass to come
     out at the brightness it was tuned to. Chosen against the rendered frame
     rather than by eye: the two together bring the near white share of the
     brain's bounding box back from 4.1% to 1.8%, against 1.0% before the
     density went up. */
  colourFactor: 0.7,
  /* Light, because the page this was tuned against is dark. A caller that
     draws the cloud over a pale page has to say so. */
  surface: { kind: "light" },
};

/* Everything the timeline produces and the renderer consumes. Each of these is
   interpolated towards its target rather than set from scroll directly, which
   is what makes scrolling backwards reverse the animation instead of jumping
   it. */
/* Which column the cloud is in, and how far through a change of columns.

   `from` and `to` are the same value whenever it is settled, with `amount` at
   nought; during a crossing they are the two columns and `amount` runs nought
   to one. `gapUv` is where the seam between the two sections is on screen,
   which is the road the crossing travels along. */
/* What the page's layout has decided about where the cloud may be, read off
   the page rather than worked out from the window.

   `wide` is whether the bands keep a lane beside their content, which they do
   from 1100 pixels: the same breakpoint as the stylesheet, read through
   matchMedia so the two cannot disagree. Below it the cloud has no column, and
   `slot` is the empty space under the hero's controls it lives in instead, in
   uv of the canvas: centre and half height up from the bottom, and its height
   in pixels. Null when there is no slot on screen or no room in it. */
export type PageLayout = {
  wide: boolean;
  slot: { centre: number; half: number; px: number } | null;
};

/* A seam between two sections whose lanes differ: the one kind of place the
   cloud can change sides, because it is the one band of the page with no text
   across it. */
export type LaneSeam = {
  /* uv y of the middle of the seam, up from the bottom of the window. */
  uv: number;
  /* The lanes of the sections above and below it, +1 right and -1 left. */
  above: number;
  below: number;
  /* uv half height of the part of it that is clear of text with the page at
     rest: the padding either side, less a margin. What the cloud is sized to
     and the split is softened over, so neither changes with how fast the page
     is moving. */
  clear: number;
  /* The same, less however far the page scrolled in the last frame, which is
     how far the compositor can be ahead of a mask worked out from script. What
     the mask cuts to: in a fast scroll the cloud's edge can be trimmed, and the
     text still cannot be reached. */
  half: number;
};

/* Which lanes are where on the screen, read off the page every frame. */
export type LaneState = {
  /* The lane of the section across the middle of the window, which is the
     cloud's when there is no seam near it. */
  here: number;
  /* Seams on or near the screen, top first. */
  seams: LaneSeam[];
};

/* The room the cloud is allowed, as the final pass needs it: everything is in
   uv, so it survives a resize and a device pixel ratio without being restated.

   This exists because the alternative was a gradient painted over the reading
   column, which held the contrast measurement down by dimming the cloud on
   whichever side the words were. Cutting the light is the same requirement
   without that cost, and it is the only version that also contains the bloom. */
export type CloudMask = {
  /* uv x of the boundary between the cloud's column and the page's, in the
     region the cloud itself is in. */
  edge: number;
  /* +1 when the cloud's column is the right of the screen, -1 the left, and 0
     where there is no column to keep out of, such as a phone. The region the
     cloud itself is in; `sides` has every region. */
  side: number;
  /* Where the lane changes on the screen, as uv y up from the bottom, top
     first, and -1 for none. The screen is split there, and each region keeps
     the cloud to its own section's column: two sections with their content on
     opposite sides can both be on screen, and the cloud's column in one is the
     other's text. */
  splits: [number, number];
  /* The column side in each region, top to bottom. */
  sides: [number, number, number];
  /* uv height over which each column fades to nothing towards a split, from
     either side. It is the seam's clear half, so the fade lies inside the seam
     and cannot reach a word; without it the split was a hard horizontal line
     sliced through a dispersed cloud. */
  splitSoft: number;
  /* How far the column's inner edge sits from the middle of the screen, in uv:
     the edge is at 0.5 + side * inner. */
  inner: number;
  /* uv width of the ramp at that boundary, measured into the cloud's own
     column so that softening the edge can never light a word. */
  feather: number;
  /* The gap between two sections: the one horizontal road across the page with
     no text on it, which is where the cloud changes sides. */
  gapCentre: number;
  /* uv half height of that strip. Nought means it is not crossing. */
  gapHalf: number;
  /* How much of the strip's half height its edge is softened over. A crossing
     softens over most of it; the phone's slot, which is the cloud's whole
     space rather than a road through somebody else's, over a small part. */
  gapSoft: number;
  /* How much of the cloud outside its own space is still drawn, from nought,
     cut, to one, everything. One while the opening animation owns the screen,
     where there is no reading to keep out of. When it hands over this eases
     to nought over a quarter of a second rather than dropping in one frame,
     so whatever the bloom's outer edge was reaching fades instead of being
     sliced off. */
  off: number;
};

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
  /* Where the cloud is allowed to be drawn, in the page's own screen space. */
  mask: CloudMask;
  /* Minus one when the cloud is in the left lane, one when it is in the right,
     and between them while it crosses. The page reads it to shade the side the
     words are on. */
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
  /* One quality level down or up, for the page's frame scheduler, which owns
     the decision and the order it is taken in. False when there is no level
     to move to, or when the level was fixed by name. */
  degrade: () => boolean;
  upgrade: () => boolean;
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
    pointerSpeed: number;
    /* Where the page is, in sections, as the timeline sees it. Exposed so the
       tests can assert the boundaries are the real ones: section n's top at the
       top of the viewport has to read exactly n, and it does not if the
       measurement was taken before the fonts moved everything. */
    scroll: number;
    /* The layout the engine is composing against: whether there is a lane,
       and where the phone's slot is. */
    layout: PageLayout;
    /* Milliseconds of the engine's own clock since its first frame, which is
       what the opening reveal is measured against. Exposed because it is the
       only way for a test to know the animation has reached a moment: the wall
       clock and the engine's clock are the same thing only on a machine that is
       keeping up, and the one this is asserted on is not. */
    since: number;
  };
};
