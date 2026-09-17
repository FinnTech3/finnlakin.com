"use client";

import { createFullscreen } from "./gl";
import { MouseController } from "./mouse";
import { clamp } from "./pack";
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

/* A frame longer than this is treated as this. Coming back to a tab that has
   been hidden for ten minutes would otherwise advance the simulation by ten
   minutes at once, which with a spring system means every particle leaves the
   screen and never returns. */
const MAX_DELTA_SECONDS = 0.1;

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
const MAX_STEPS_PER_FRAME = 6;

/* How long the opening reveal takes to draw the cloud in from its dispersed
   start. */
const SHOW_SECONDS = 2.4;

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  config?: Partial<ParticleBrainConfig>;
  /* Forced by the tests and by the debug flag, so that a machine which would
     otherwise be stepped straight down can be asked for the full picture. */
  quality?: QualityLevel;
  reducedMotion?: boolean;
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

  const set = buildTargetSet(brainTargets(config.gridSize * config.gridSize, SEED), config.gridSize);
  const simulation = ParticleSimulation.create(context, capability, fullscreen, set);
  const renderer = simulation ? ParticleRenderer.create(context, config.gridSize) : null;
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

  const baseFactor = mobile ? config.factorMobile : config.factorDesktop;
  const timeline = new ParticleTimeline(baseFactor);
  const mouse = new MouseController(mobile, config.mouseSmoothing);
  const scroll = new ScrollController(config.scrollEase);

  let width = 1;
  let height = 1;
  let seconds = 0;
  let previousMs = 0;
  let show = reducedMotion ? 1 : 0;
  let lastFrameMs = 0;
  let accumulator = 0;
  let postUsable = Boolean(post);

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
    scroll.measure();
  }

  function applyLevel(next: QualityLevel) {
    level = next;
    tier = tierFor(level, mobile);
    watch.reset();
    resize();
  }

  resize();
  scroll.settle();

  /* A reader who asked for less motion gets one frame, so the simulation has to
     arrive at the answer before it is drawn rather than springing towards it.
     Stepped here, at startup, rather than animated. */
  if (reducedMotion) {
    const settled = timeline.settle(scroll.value.sectionProgress);
    const inputs = { progress: settled.progress, explode: settled.explode, show: 1, delta: { x: 0, y: 0 } };
    for (let i = 0; i < 240; i++) simulation.step(inputs, config, mobile);
  }

  function frame(nowMs: number) {
    const started = nowMs;
    if (previousMs === 0) previousMs = nowMs;
    const delta = clamp((nowMs - previousMs) / 1000, 0, MAX_DELTA_SECONDS);
    previousMs = nowMs;
    seconds += delta;

    if (!reducedMotion && show < 1) {
      show = clamp(show + delta / SHOW_SECONDS, 0, 1);
    }

    scroll.read();
    const progress = reducedMotion ? scroll.settle() : scroll.update(delta);
    if (reducedMotion) mouse.still();
    else mouse.update(delta);
    const state = reducedMotion
      ? timeline.settle(progress)
      : timeline.update(progress, config.timelineEase, delta);

    const inputsForStep = {
      progress: state.progress,
      explode: state.explode,
      show,
      delta: mouse.value.delta,
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
      timeline: state,
      seconds,
      mouse: mouse.value.current,
      pitch: mouse.pitch,
      yaw: mouse.yaw,
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

    if (chain) chain.render(tier.post, config, seconds);

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
    setConfig(partial) {
      Object.assign(config, partial);
      timeline.setBaseFactor(mobile ? config.factorMobile : config.factorDesktop);
    },
    resize,
    frame,
    dispose() {
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
      };
    },
  };
}
