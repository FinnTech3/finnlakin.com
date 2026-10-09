"use client";

import { createFullscreen } from "./gl";
import { MouseController, pointerInCloudSpace } from "./mouse";
import { entryField } from "./entrance";
import { clamp, mulberry32 } from "./pack";
import {
  detectCapability,
  initialLevel,
  detectDevice,
  tierFor,
  type Capability,
  type Tier,
} from "./quality";
import { PostChain } from "./post";
import { CAMERA_FOV, CAMERA_POSITION, ParticleRenderer } from "./renderer";
import { ScrollController } from "./scroll";
import { ParticleSimulation } from "./simulation";
import { buildTargetSet, SEED } from "./targets";
import { pageShapes } from "./structures";
import { introFactor, wordShape } from "./words";
import { mapClamped } from "./pack";
import { OPENING, openingMorph } from "./opening";
import {
  DEFAULTS,
  type CloudMask,
  type ParticleBrain,
  type ParticleBrainConfig,
  type QualityLevel,
} from "./types";
import { sampleOf } from "./extent";
import { ParticleTimeline } from "./timeline";

/* The engine. Everything above it is a part; this is what makes them a system.

   The page that mounts this knows nothing about framebuffers, and that is the
   contract: a canvas goes in, and a handful of methods come back. If a machine
   cannot run any of it, createParticleBrain returns null and the caller shows
   whatever it was going to show anyway. Nothing here throws and nothing here
   writes to the console in production, because every route on this site is
   asserted console clean and a decorative background must never be the thing
   that breaks that in front of a reader. */

/* How much real time one frame is allowed to account for.

   This used to be a tenth of a second, chosen to keep the spring stable, and
   that was solving a problem the fixed sub step below already solves: every
   integration step is a sixtieth of a second whatever happens, so stability is
   guaranteed by the step size and not by this. What this actually bounds is
   catch up work, and a tenth of a second was bounding it far too tightly: at
   two frames a second the simulation was being given a tenth of a second of
   time for every half second that passed, so it ran at a fifth speed and the
   opening word was a smear when it should have been a word.

   Half a second is enough to keep real time down to two frames a second, and
   small enough that returning to a tab hidden for ten minutes advances the
   spring by half a second rather than by ten minutes. */
const MAX_DELTA_SECONDS = 0.5;

/* The spring constants the specification gives are per frame at sixty frames a
   second, not per second. Run once a frame they describe a different animation
   on every machine: on the software rasteriser in the test environment the
   cloud was still on its way in after seven seconds, because it had had
   seventy steps rather than four hundred.

   So the simulation runs on its own fixed clock and the frame loop feeds it
   however many steps have come due. The spring values then mean what they say,
   and the cloud settles in the same time everywhere. This is cheap to do: both
   simulation passes cover a hundred pixels square, which next to ten thousand
   instanced pyramids is nothing, so six of them cost less than one of the
   draws they are feeding. */
const SIMULATION_STEP_SECONDS = 1 / 60;

/* Enough steps to keep the simulation's clock on the wall down to about three
   frames a second. Six was not: at the two frames a second a software
   rasteriser manages at the top quality level, the spring was getting a fifth
   of the steps it needed and the opening word was still an unresolved smear
   several seconds after it should have read. Twenty costs nothing where it is
   not needed, because a machine drawing sixty frames a second takes exactly one
   of them, and where it is needed it is forty draws over a hundred pixels
   square against one pass over ten thousand instanced solids. */
const MAX_STEPS_PER_FRAME = 20;

/* How long the opening reveal spends releasing the cloud.

   This is not how long the entrance takes. Every particle starts off the edge
   of the screen and is released into the spring at its own moment, and this is
   the span those moments are spread over; the flight itself is the spring's
   business and takes about another nine tenths of a second on top. So the last
   particle to be released lands at roughly this plus one, which has to stay
   comfortably inside the first word's phase below or the word morphs away while
   part of it is still arriving. */
const SHOW_SECONDS = 1.0;

/* The opening animation's clock is read straight off the wall rather than
   accumulated from frames.

   Accumulating deltas is right for the simulation, which clamps each step to
   stay stable, but that clamp makes its clock run behind on a slow machine.
   Measured here at the forced top quality level, which is about two frames a
   second on a software rasteriser, a six second intro was taking over eleven
   and ending on its safety ceiling instead of its handover. Any cap large
   enough to fix that is large enough to be no cap at all, so this is an
   absolute time: the phases keep wall time on every machine, and a reader who
   switches away and comes back finds it finished, which is what they would
   want anyway. */

/* The opening animation's phases are in opening.ts, with the reasons for their
   numbers: this plays them. See the note at the hand-over in frame() for why the
   composition travels to the page's own place before the hold is released. */
const INTRO_LINES: string[][] = [["FINN LAKIN"], ["ECONOMICS,", "FINANCE,", "SOFTWARE DEV"]];

/* The opening's shapes are the first word, the second and the brain, in the
   first three slots of its own texture, one after the next. */
const INTRO_CHAIN: readonly number[] = [0, 1, 2];

/* Where a number along a chain of shapes is: the two slots it is between and how
   far from the first to the second. A whole number is a shape and has nothing
   to be between, which reads as the shape and no distance. */
function between(progress: number, chain: readonly number[]) {
  if (chain.length < 2) {
    const only = chain[0] ?? 0;
    return { from: only, to: only, mix: 0 };
  }
  const at = clamp(progress, 0, chain.length - 1);
  const link = Math.min(Math.floor(at), chain.length - 2);
  return { from: chain[link]!, to: chain[link + 1]!, mix: at - link };
}

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  config?: Partial<ParticleBrainConfig>;
  /* Forced by the tests and by the debug flag, so that a machine which would
     otherwise be stepped straight down can be asked for the full picture. */
  quality?: QualityLevel;
  reducedMotion?: boolean;
  /* Whether this load opens with the animation. Decided before first paint by
     the inline script in the layout, so a second page view in the same session
     and a reader who asked for less motion never see it. */
  intro?: boolean;
  onIntroEnd?: () => void;
};


/* The mask, as a clip path, for when the post chain could not be built and there
   is no final pass to run it in.

   That is not the low tier, which runs the final pass without bloom or depth of
   field and has the real mask. It is a machine with no float render target, or
   a shader that will not link.

   Percentages rather than pixels, so it needs no resize handler, and the same
   numbers the shader gets rather than a second set: the fallback and the full
   path cut the cloud in the same place or the fallback is not a fallback.

   A path rather than an inset, because the keep-out is up to three regions'
   columns and a seam, and an inset is one rectangle. CSS counts from the top
   and the mask's y counts from the bottom, which is the one conversion here
   and the one thing to get wrong. */
function clipFor(mask: CloudMask, width: number, height: number): string {
  if (mask.off > 0.5) return "none";
  const rects: [number, number, number, number][] = [];
  const px = (value: number) => Math.round(value * 10) / 10;
  const add = (x0: number, top: number, x1: number, bottom: number) => {
    const t = Math.min(1, Math.max(0, top));
    const b = Math.min(1, Math.max(0, bottom));
    if (t - b <= 0 || x1 - x0 <= 0) return;
    rects.push([px(x0 * width), px((1 - t) * height), px(x1 * width), px((1 - b) * height)]);
  };

  /* Each region's column, top to bottom, between the splits. */
  const [first, second] = mask.splits;
  const tops = [1, first >= 0 ? first : -1, second >= 0 ? second : -1];
  const bottoms = [first >= 0 ? first : 0, second >= 0 ? second : 0, 0];
  for (let i = 0; i < 3; i++) {
    const side = mask.sides[i]!;
    if (side === 0 || tops[i]! < 0) continue;
    const edge = 0.5 + side * mask.inner;
    if (side > 0) add(edge, tops[i]!, 1, bottoms[i]!);
    else add(0, tops[i]!, edge, bottoms[i]!);
  }
  /* And the seam, or the phone's slot, across the whole width. */
  if (mask.gapHalf > 0) add(0, mask.gapCentre + mask.gapHalf, 1, mask.gapCentre - mask.gapHalf);

  /* No column, no strip and no escape is a cloud with nowhere to be, which is
     a phone whose slot has no room. That is everything clipped, not nothing:
     "none" here would have drawn the whole cloud over the page. */
  if (rects.length === 0) return "inset(50%)";
  return `path("${rects.map(([x0, y0, x1, y1]) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`).join("")}")`;
}

/* The same question for the frame loop: is there anywhere at all this cloud
   may be seen? When there is not, a frame drawn is a frame nobody sees. */
function keepsNothing(mask: CloudMask) {
  return mask.off <= 0 && mask.side === 0 && mask.gapHalf <= 0;
}

export function createParticleBrain(options: EngineOptions): ParticleBrain | null {
  const { canvas } = options;

  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const context: WebGL2RenderingContext = gl;

  const capability: Capability | null = detectCapability(context);
  if (!capability) return null;

  const config: ParticleBrainConfig = { ...DEFAULTS, ...options.config };
  const device = detectDevice();
  /* Small, as opposed to touch: see Device in quality.ts. Everything below that
     is about how much a screen has room for reads this. How large the cloud is
     drawn is the layout's to say and is read off the page in the timeline. */
  const compact = device.compact;
  const reducedMotion = options.reducedMotion ?? false;

  const fullscreen = createFullscreen(context);
  if (!fullscreen) return null;

  /* A phone draws half as many particles, so it builds half as many rather than
     spending a couple of hundred milliseconds of its slower processor sampling
     a cloud its tier will throw away. */
  const gridSize = compact ? config.gridSizeCompact : config.gridSize;
  const count = gridSize * gridSize;
  const built = pageShapes(count, SEED);
  /* The same tone for every shape: it belongs to the particle and not to the
     shape, so a particle keeps its colour identity as it morphs rather than
     being recoloured by whatever shape it is in. */
  const scrollSet = buildTargetSet(
    built.shapes,
    gridSize,
    built.shapes.map(() => built.tone),
    built.relief,
  );

  /* The opening animation is not a separate system. It is the same target
     texture with two words in it and the brain in the third slot, so the words
     are made of the identical ten thousand pyramids and become the brain by the
     same morph that carries every other transition. */
  /* The canvas's own shape rather than the window's. Below the breakpoint the
     canvas covers the first screen at its largest, which on a phone is taller
     than the window while the address bar is showing, and the words are laid
     out for the surface they are drawn on. */
  const box = canvas.getBoundingClientRect();
  const boxWidth = box.width || window.innerWidth;
  const boxHeight = box.height || window.innerHeight;
  const aspect = Math.max(0.3, boxWidth / Math.max(1, boxHeight));

  /* Where the middle of the window falls on the canvas, in the cloud's world
     units. Nought wherever the canvas is the window. Below the breakpoint the
     canvas runs from the top of the page to the bottom of the phone's slot,
     which is usually past the fold, and the opening animation is composed on
     the window the reader is looking at rather than on the middle of a canvas
     that is partly below it. */
  const halfWorld = Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const windowCentreY = (surface: number) => {
    const view = Math.min(window.innerHeight, surface);
    return (0.5 - view / 2 / Math.max(1, surface)) * 2 * halfWorld;
  };
  const wordsFactor = introFactor(aspect);
  const runIntro = Boolean(options.intro) && !(options.reducedMotion ?? false);

  const introSet = runIntro
    ? (() => {
        /* The brain here is the same brain the page uses, at the same scale,
           so that swapping one target set for the other at the hand-over moves
           no particle at all.

           It used to be stored shrunk by the ratio of the desktop factor to the
           words' factor, so that the texture and the factor would cancel at the
           hand-over. They never did: the targets switch in a frame and the
           factor eases, so on a monitor the brain swelled by a factor of 1.6 and
           shrank back, and on a phone, where the ratio used the desktop factor
           rather than the phone's, it ended the animation at four fifths of the
           screen's width and collapsed to half that. Now the composition itself
           travels to the page's opening place before the hand-over, and the
           size goes with it. */
        const brain = built.shapes[0]!;
        return buildTargetSet(
          [
            wordShape(INTRO_LINES[0]!, boxWidth, boxHeight, count, SEED + 3),
            wordShape(INTRO_LINES[1]!, boxWidth, boxHeight, count, SEED + 5),
            brain,
          ],
          gridSize,
          [null, null, built.tone],
          built.relief,
        );
      })()
    : null;

  const set = introSet ?? scrollSet;

  /* Built before the simulation, because the simulation's first act is to seed
     every particle off the edge of the screen and the edge of the screen is
     only knowable through the composition the reveal opens in. */
  const timeline = new ParticleTimeline(
    { lane: config.factorLane, slot: config.factorSlot },
    aspect,
  );
  /* A sample of every shape, which the timeline measures where the cloud is
     drawn each time it sizes it, so the cloud is sized to the room the page
     leaves it whatever it is being and wherever it is. */
  timeline.setShapes(built.shapes.map((shape) => sampleOf(shape, count)));
  const mouse = new MouseController(device.touch, config.mouseSmoothing);
  const scroll = new ScrollController(config.scrollEase);

  /* The intro holds the cloud square on, centred and at the words' own factor;
     without it the page opens on the timeline's resting composition, which the
     timeline is already constructed at. Either way this is the transform the
     first frame will use, so a particle placed just outside the frame by it is
     genuinely just outside the frame. */
  const entryState = runIntro
    ? {
        ...timeline.current,
        offset: { x: 0, y: windowCentreY(boxHeight), z: 0 },
        factor: wordsFactor,
        rotation: { x: 0, y: 0, z: 0 },
      }
    : timeline.current;
  /* Seeded, so the opening is the same picture every load and a screenshot
     taken at a fixed moment means something. */
  const entry = reducedMotion ? null : entryField(entryState, aspect, mulberry32(SEED + 211));

  const simulation = ParticleSimulation.create(context, capability, fullscreen, set, entry);
  const renderer = simulation ? ParticleRenderer.create(context, gridSize) : null;
  /* The post chain is allowed to fail on its own. Without it the particles are
     drawn straight to the screen, which is a quieter picture but a complete
     one, and that is a much better outcome than no cloud at all. */
  const post = renderer ? PostChain.create(context, capability, fullscreen) : null;
  if (!simulation || !renderer) {
    simulation?.dispose();
    post?.dispose();
    fullscreen.dispose();
    return null;
  }

  let level: QualityLevel = options.quality ?? initialLevel(capability, device);
  let tier: Tier = tierFor(level, device);
  /* Whether the page's frame scheduler may move this between levels. Not when
     a level was asked for by name, which is how the tests hold one still, and
     not for a reader who asked for less motion, who gets one settled frame
     per scroll rather than a loop and so has no frame rate to govern. */
  const adaptive = !options.quality && !reducedMotion;

  let width = 1;
  let height = 1;
  /* The canvas's size in CSS pixels, which is what a pointer is measured in. */
  let surfaceWidth = 1;
  let surfaceHeight = 1;
  /* Whether the last frame drawn was cut to nothing, so the next one like it
     need not be drawn at all. */
  let lastEmpty = false;
  let seconds = 0;
  let previousMs = 0;
  let show = reducedMotion ? 1 : 0;
  let lastFrameMs = 0;
  let accumulator = 0;
  let lastPointer: [number, number, number] = [0.5, 0.5, 0.5];
  let lastPointerActive = 0;
  let postUsable = Boolean(post);
  let introActive = runIntro;
  let introMs = 0;
  /* When the first frame ran. The opening reveal and the animation's phases are
     both measured from here rather than accumulated from frame deltas: the
     deltas are clamped to keep the spring stable, so on a slow machine they run
     behind the wall and anything timed off them plays in slow motion. The
     reveal was taking four and a half seconds instead of nine tenths. */
  let clockStartedMs = 0;
  let elapsedMs = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || window.innerWidth);
    const cssHeight = Math.max(1, rect.height || window.innerHeight);
    surfaceWidth = cssWidth;
    surfaceHeight = cssHeight;

    /* The drawing buffer is capped by area rather than by edge. A tall phone and
       a wide monitor have very different edges and very similar pixel counts,
       and it is the pixel count that costs. */
    const maxPixels = 2_200_000;
    const requested = tier.pixelRatio;
    const scale = Math.min(requested, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
    const ratio = Math.max(0.6, scale);

    width = Math.round(cssWidth * ratio);
    height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    renderer!.resize(width, height);
    if (post && !post.resize(width, height)) postUsable = false;
    timeline.setAspect(cssWidth / Math.max(1, cssHeight));
    scroll.measure();
  }

  function applyLevel(next: QualityLevel) {
    level = next;
    tier = tierFor(level, device);
    resize();
  }

  /* The last rung of the page's ladder, and only reached once the decoration
     above it has already been thinned and dropped. See particles/frame.ts. */
  const LEVELS: QualityLevel[] = ["low", "medium", "high"];
  function shift(by: 1 | -1): boolean {
    if (!adaptive) return false;
    const next = LEVELS[LEVELS.indexOf(level) + by];
    if (!next) return false;
    applyLevel(next);
    return true;
  }

  resize();
  /* Re-measured whenever the page moves under it, not only on window resize.
     The boundaries are read from the real sections, and the fonts that decide
     how tall those sections are have not arrived yet at this point. */
  scroll.watch();
  scroll.settle();

  /* Where the timeline starts.

     Its constructor starts it at the opening composition, which is right for a
     reader arriving at the top and wrong for one who reloaded halfway down or
     followed a link straight to a section: the eased timeline would set off
     from the opening and play the drift, the explosion and both morphs to catch
     up. The opening animation is the one case that still wants the ease,
     because the whole point of holding the composition is that releasing the
     hold carries the cloud into place. */
  if (!runIntro) timeline.settle(scroll.value.sectionProgress);

  /* A reader who asked for less motion gets one frame, so the simulation has to
     arrive at the answer before it is drawn rather than springing towards it.
     Stepped here, at startup, rather than animated. */
  if (reducedMotion) {
    const settled = timeline.settle(scroll.value.sectionProgress, scroll.laneState());
    const inputs = {
      ...between(settled.progress, scroll.chain),
      explode: settled.explode,
      show: 1,
      pointer: [0.5, 0.5, 0.5] as [number, number, number],
      pointerActive: 0,
      pointerSpeed: 0,
    };
    for (let i = 0; i < 240; i++) simulation.step(inputs, config, compact);
  }

  /* The end of the opening animation, whether it ran its course or a reader
     cut it short by touching something.

     The scroll position is settled rather than left to ease, because the
     composition was held while the animation played and the page could have
     moved a long way under it: any scroll ends the intro, but a reader who
     flings the page and then waits out the dissolve would otherwise have the
     timeline set off from wherever the eased value had got to. */
  function handOver() {
    if (!introActive) return;
    introActive = false;
    simulation!.setTargets(scrollSet);
    scroll.settle();
    options.onIntroEnd?.();
  }

  function frame(nowMs: number) {
    const started = nowMs;
    if (previousMs === 0) previousMs = nowMs;
    if (clockStartedMs === 0) clockStartedMs = nowMs;
    const sinceStart = nowMs - clockStartedMs;
    elapsedMs = sinceStart;
    const delta = clamp((nowMs - previousMs) / 1000, 0, MAX_DELTA_SECONDS);
    previousMs = nowMs;
    seconds += delta;

    if (!reducedMotion) {
      show = clamp(sinceStart / (SHOW_SECONDS * 1000), 0, 1);
    }

    scroll.read();
    const progress = reducedMotion ? scroll.settle() : scroll.update(delta);
    if (reducedMotion) mouse.still();
    else mouse.update(delta);
    timeline.setLayout(scroll.layout);

    let state;
    let shapes: { from: number; to: number; mix: number };
    if (introActive) {
      introMs = sinceStart;
      /* Two transitions, each a straight ramp. The wave across the cloud comes
         from the per particle ordering in the shader, not from shaping this. */
      shapes = between(openingMorph(introMs), INTRO_CHAIN);
      /* Settled into place before the page takes over.

         The page's own composition is somewhere else entirely: on a monitor
         the brain opens in the right hand column, smaller than it is drawn
         here and turned a little. The hand-over used to release the hold with
         the brain still in the middle of the screen, so the keep-out that
         stops it lighting the words came on over a brain that was mostly
         outside its column, and cut most of it away in one frame before the
         rest slid across. So the composition travels there first, eased, while
         the veil is still up and nothing else is on the screen, and at the
         hand-over the page's composition and this one are the same numbers. */
      const place = timeline.peek(progress, scroll.laneState());
      const t = mapClamped(introMs, OPENING.settleFrom, OPENING.handoverAt, 0, 1);
      const settle = t * t * (3 - 2 * t);
      const centre = windowCentreY(surfaceHeight);
      state = timeline.hold(
        {
          x: place.offset.x * settle,
          y: centre + (place.offset.y - centre) * settle,
          z: place.offset.z * settle,
        },
        wordsFactor + (place.factor - wordsFactor) * settle,
        place.rotation.y * settle,
      );

      if (introMs >= OPENING.handoverAt) {
        handOver();
        /* The page's own shapes from this frame on. The targets were swapped
           for the page's in the call above, so the slots this frame had were
           the opening's and mean something else in the texture it has now. */
        shapes = between(0, scroll.chain);
      }
    } else {
      const lane = scroll.laneState();
      state = reducedMotion
        ? timeline.settle(progress, lane)
        : timeline.update(progress, config.timelineEase, delta, lane);
      shapes = between(state.progress, scroll.chain);
    }

    /* Cut to nothing, and the last frame was too: a phone held sideways, where
       the slot under the controls has no room for a brain. The canvas already
       shows nothing, so the simulation and every pass of the draw are skipped
       until there is somewhere for the cloud to be again. */
    const empty = keepsNothing(state.mask);
    if (empty && lastEmpty) {
      lastFrameMs = performance.now() - started;
      return;
    }
    lastEmpty = empty;

    /* The pointer, carried back through the projection into the space the
       simulation works in, so the shader can push particles away from it. Done
       once a frame on the processor rather than per particle on the card. */
    const pointer = pointerInCloudSpace(
      mouse.value.current,
      state,
      width / Math.max(1, height),
    );

    const pointerActive = introActive || reducedMotion ? 0 : mouse.active;
    /* How fast the pointer is moving, as a number the shader can scale by.
       MouseState.delta has been computed, smoothed and clamped every frame since
       the engine was written and read by nothing at all; this is where it goes.
       The magnitude is divided by the clamp the controller already applies, so
       it arrives as nought to one whatever that clamp is set to. */
    const speed = pointerActive
      ? Math.min(1, Math.hypot(mouse.value.delta.x, mouse.value.delta.y) / 2)
      : 0;
    lastPointer = pointer;
    lastPointerActive = pointerActive;

    const inputsForStep = {
      ...shapes,
      explode: state.explode,
      show,
      pointer,
      /* No parting during the opening animation: the words are being read. */
      pointerActive,
      pointerSpeed: speed,
    };

    accumulator += delta;
    let steps = 0;
    while (accumulator >= SIMULATION_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      simulation!.step(inputsForStep, config, compact);
      accumulator -= SIMULATION_STEP_SECONDS;
      steps += 1;
    }
    /* Whatever is left over after the cap is dropped rather than carried, so a
       machine that is permanently behind does not build a debt it can never pay
       and then discharge it all at once when it catches up. */
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    /* A frame that came due for no step at all still has to draw something, and
       the first frame of all must run the simulation once or the particles are
       drawn from an unwritten texture. */
    if (steps === 0 && seconds <= delta) simulation!.step(inputsForStep, config, compact);

    /* The clock the picture is drawn at, as opposed to the one the simulation
       runs on. For a reader who asked for less motion it stands still: the
       film grain and anything else keyed to time used to be drawn afresh on
       every settled frame, so every step of a scroll flickered the grain, which
       is motion, however fine. The same page position now draws the same
       picture. */
    const drawnAt = reducedMotion ? 0 : seconds;

    const inputs = {
      timeline: state,
      morph: shapes,
      seconds: drawnAt,
      mouse: mouse.value.current,
      pitch: 0,
      yaw: 0,
      instances: tier.instances,
      compact,
    };

    const chain = postUsable && post ? post : null;
    const scene = chain?.sceneTarget ?? null;

    /* The depth pass first, because the defocus needs it and because it wants
       the depth buffer cleared before the colour pass, which does not use it. */
    if (chain && tier.post === "full") {
      const depth = chain.depthTarget;
      if (depth) {
        context.bindFramebuffer(context.FRAMEBUFFER, depth.framebuffer);
        context.viewport(0, 0, depth.width, depth.height);
        context.clearColor(0, 0, 0, 1);
        context.clearDepth(1);
        context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
        renderer!.drawDepth(
          inputs,
          config,
          simulation!.positionTexture,
          simulation!.scale,
          simulation!.colour,
        );
      }
    }

    context.bindFramebuffer(context.FRAMEBUFFER, scene ? scene.framebuffer : null);
    context.viewport(0, 0, scene ? scene.width : width, scene ? scene.height : height);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);

    renderer!.drawColour(
      inputs,
      config,
      simulation!.positionTexture,
      simulation!.scale,
      simulation!.colour,
    );

    if (chain) {
      chain.render(tier.post, config, drawnAt, state.mask);
    } else {
      /* No post chain means no final pass, so the mask that keeps the cloud off
         the words is not running. The canvas element carries the same cut
         instead, as a clip path: one style property, set only when it changes,
         which the compositor applies for free.

         Keeping text clear of the cloud is not something to leave to a fallback
         path. The low tier is what a weak machine gets, and a weak machine is
         exactly the one whose reader can least afford a paragraph printed over
         a light source.

         The ink surfaces are not available here at all, and the canvas is
         hidden rather than drawn wrong. Their conversion is the final pass, so
         without it the particles reach the page as raw additive light: over a
         pale sheet that is a faint grey haze with no picture in it. A page
         that loses its cloud has lost a decoration; a page that gains a haze
         over its reading has lost more than that. */
      const clip =
        config.surface.kind === "light"
          ? clipFor(state.mask, surfaceWidth, surfaceHeight)
          : "inset(50%)";
      if (canvas.style.clipPath !== clip) canvas.style.clipPath = clip;
    }


    lastFrameMs = performance.now() - started;
  }

  return {
    setQuality(next) {
      applyLevel(next);
    },
    degrade() {
      return shift(-1);
    },
    upgrade() {
      return shift(1);
    },
    pointer(clientX, clientY) {
      /* Against the canvas, not the window. Above the breakpoint the canvas is
         the window; below it the canvas is over the first screen of the page
         and scrolls with it, and a narrow desktop window has a mouse. */
      const top = scroll.layout.wide ? 0 : -window.scrollY;
      mouse.move(clientX, clientY - top, surfaceWidth, surfaceHeight);
    },
    pointerLeave() {
      mouse.leave();
    },
    endIntro() {
      handOver();
    },
    setConfig(partial) {
      Object.assign(config, partial);
      timeline.setBaseFactors({ lane: config.factorLane, slot: config.factorSlot });
    },
    resize,
    frame,
    dispose() {
      scroll.unwatch();
      simulation.dispose();
      renderer.dispose();
      post?.dispose();
      fullscreen.dispose();
      const lose = context.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    },
    inspect() {
      return {
        quality: level,
        instances: tier.instances,
        device,
        pixelRatio: tier.pixelRatio,
        frameMs: lastFrameMs,
        timeline: timeline.current,
        pointer: lastPointer,
        pointerActive: lastPointerActive,
        pointerSpeed: 0,
        scroll: scroll.value.sectionProgress,
        layout: scroll.layout,
        since: elapsedMs,
      };
    },
  };
}
