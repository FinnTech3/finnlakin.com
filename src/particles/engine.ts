"use client";

import { createFullscreen } from "./gl";
import { MouseController, pointerInCloudSpace } from "./mouse";
import { entryField } from "./entrance";
import { clamp, mulberry32 } from "./pack";
import {
  createFrameWatch,
  detectCapability,
  initialLevel,
  isMobile,
  tierFor,
  type Capability,
  type Tier,
} from "./quality";
import { PostChain } from "./post";
import { ParticleRenderer } from "./renderer";
import { ScrollController } from "./scroll";
import { ParticleSimulation } from "./simulation";
import { buildTargetSet, SEED } from "./targets";
import { brainTargets } from "./brain-shape";
import { introFactor, rescale, wordShape } from "./words";
import { mapClamped } from "./pack";
import { DEFAULTS, type ParticleBrain, type ParticleBrainConfig, type QualityLevel } from "./types";
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

/* The opening animation, in milliseconds from the first frame. The first word
   assembles, becomes the second, and the second becomes the brain; then the
   hold on the composition is released and the page takes over.

   These are the timings from the version Finn watched, kept because they were
   arrived at by watching rather than by reasoning. */
/* The first word needs longer than it looks, and the reason is measurable
   rather than aesthetic. The reveal draws the cloud in over nine tenths of a
   second, and only once it has arrived does the spring start closing the last
   of the distance, which at a spring of six thousandths and a friction of
   0.892 takes about another seventy steps. So the word is not actually a word
   until roughly two seconds in. Starting the second phase at 2300 had it
   morphing away at the moment it became legible. */
const WORD_TWO_FROM = 3000;
const WORD_TWO_TO = 4200;
const BRAIN_FROM = 5000;
const BRAIN_TO = 6300;
const HANDOVER_AT = 6900;

const INTRO_LINES: string[][] = [["FINN LAKIN"], ["ECONOMICS,", "FINANCE,", "SOFTWARE DEV"]];

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
  const mobile = isMobile();
  const reducedMotion = options.reducedMotion ?? false;

  const fullscreen = createFullscreen(context);
  if (!fullscreen) return null;

  /* A phone draws half as many particles, so it builds half as many rather than
     spending a couple of hundred milliseconds of its slower processor sampling
     a cloud its tier will throw away. */
  const gridSize = mobile ? config.gridSizeMobile : config.gridSize;
  const count = gridSize * gridSize;
  const built = brainTargets(count, SEED);
  /* The same tone for all four quadrants: the other three shapes are per
     particle derivations of the brain, so a particle keeps its colour identity
     as it morphs rather than being recoloured by whatever shape it is in. */
  const scrollSet = buildTargetSet(
    built.shapes,
    gridSize,
    [built.tone, built.tone, built.tone, built.tone],
    built.relief,
  );

  /* The opening animation is not a separate system. It is the same four
     quadrant target texture with two words in it and the brain in the other
     two, so the words are made of the identical ten thousand pyramids and
     become the brain by the same morph that carries every other transition. */
  const aspect = Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
  const wordsFactor = introFactor(aspect);
  const runIntro = Boolean(options.intro) && !(options.reducedMotion ?? false);

  const introSet = runIntro
    ? (() => {
        /* The brain is stored here shrunk by exactly the ratio between the two
           factors, so that at the handover the texture and the factor change in
           the same frame and cancel: the picture does not move. */
        const shrunk = rescale(built.shapes[0]!, count, config.factorDesktop / wordsFactor);
        return buildTargetSet(
          [
            wordShape(INTRO_LINES[0]!, window.innerWidth, window.innerHeight, count, SEED + 3),
            wordShape(INTRO_LINES[1]!, window.innerWidth, window.innerHeight, count, SEED + 5),
            shrunk,
            shrunk,
          ],
          gridSize,
          [null, null, built.tone, built.tone],
          built.relief,
        );
      })()
    : null;

  const set = introSet ?? scrollSet;

  /* Built before the simulation, because the simulation's first act is to seed
     every particle off the edge of the screen and the edge of the screen is
     only knowable through the composition the reveal opens in. */
  const baseFactor = mobile ? config.factorMobile : config.factorDesktop;
  const timeline = new ParticleTimeline(baseFactor, aspect);
  const mouse = new MouseController(mobile, config.mouseSmoothing);
  const scroll = new ScrollController(config.scrollEase);

  /* The intro holds the cloud square on, centred and at the words' own factor;
     without it the page opens on the timeline's resting composition, which the
     timeline is already constructed at. Either way this is the transform the
     first frame will use, so a particle placed just outside the frame by it is
     genuinely just outside the frame. */
  const entryState = runIntro
    ? {
        ...timeline.current,
        offset: { x: 0, y: 0, z: 0 },
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

  let level: QualityLevel = options.quality ?? initialLevel(capability, mobile);
  let tier: Tier = tierFor(level, mobile);
  const watch = createFrameWatch(level);
  const adaptive = !options.quality;

  let width = 1;
  let height = 1;
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
    tier = tierFor(level, mobile);
    watch.reset();
    resize();
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
    const settled = timeline.settle(scroll.value.sectionProgress);
    const inputs = {
      progress: settled.progress,
      explode: settled.explode,
      show: 1,
      pointer: [0.5, 0.5, 0.5] as [number, number, number],
      pointerActive: 0,
    };
    for (let i = 0; i < 240; i++) simulation.step(inputs, config, mobile);
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

    let state;
    let morph;
    if (introActive) {
      introMs = sinceStart;
      /* Two transitions, each a straight ramp. The wave across the cloud comes
         from the per particle ordering in the shader, not from shaping this. */
      morph =
        mapClamped(introMs, WORD_TWO_FROM, WORD_TWO_TO, 0, 1) +
        mapClamped(introMs, BRAIN_FROM, BRAIN_TO, 0, 1);
      state = timeline.hold({ x: 0, y: 0, z: 0 }, wordsFactor, 0);

      if (introMs >= HANDOVER_AT) handOver();
    } else {
      state = reducedMotion
        ? timeline.settle(progress)
        : timeline.update(progress, config.timelineEase, delta);
      morph = state.progress;
    }

    /* The pointer, carried back through the projection into the space the
       simulation works in, so the shader can push particles away from it. Done
       once a frame on the processor rather than per particle on the card. */
    const pointer = pointerInCloudSpace(
      mouse.value.current,
      state,
      width / Math.max(1, height),
    );

    const pointerActive = introActive || reducedMotion ? 0 : mouse.active;
    lastPointer = pointer;
    lastPointerActive = pointerActive;

    const inputsForStep = {
      progress: morph,
      explode: state.explode,
      show,
      pointer,
      /* No parting during the opening animation: the words are being read. */
      pointerActive,
    };

    accumulator += delta;
    let steps = 0;
    while (accumulator >= SIMULATION_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      simulation!.step(inputsForStep, config, mobile);
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
    if (steps === 0 && seconds <= delta) simulation!.step(inputsForStep, config, mobile);

    const inputs = {
      timeline: introActive ? { ...state, progress: morph } : state,
      seconds,
      mouse: mouse.value.current,
      pitch: 0,
      yaw: 0,
      instances: tier.instances,
      mobile,
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
      chain.render(tier.post, config, seconds, state.contentDim);
    } else {
      /* No post chain means no final pass, so the one place the dimming lives
         is not running. The canvas element carries it instead: a single style
         property, set only when it changes, which the compositor applies for
         free. Contrast is not something to leave to a fallback path. */
      const opacity = (1 - state.contentDim).toFixed(3);
      if (canvas.style.opacity !== opacity) canvas.style.opacity = opacity;
    }

    lastFrameMs = performance.now() - started;

    if (adaptive && !reducedMotion) {
      const next = watch.sample(nowMs);
      if (next) applyLevel(next);
    }
  }

  return {
    setQuality(next) {
      applyLevel(next);
    },
    pointer(clientX, clientY) {
      mouse.move(clientX, clientY, window.innerWidth, window.innerHeight);
    },
    pointerLeave() {
      mouse.leave();
    },
    endIntro() {
      handOver();
    },
    setConfig(partial) {
      Object.assign(config, partial);
      timeline.setBaseFactor(mobile ? config.factorMobile : config.factorDesktop);
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
        frameMs: lastFrameMs,
        timeline: timeline.current,
        pointer: lastPointer,
        pointerActive: lastPointerActive,
        scroll: scroll.value.sectionProgress,
        since: elapsedMs,
      };
    },
  };
}
