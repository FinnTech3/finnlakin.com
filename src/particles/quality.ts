import { createTarget, disposeTarget } from "./gl";
import type { PostLevel, QualityLevel } from "./types";

/* What the machine can actually do, and what to ask of it.

   Both halves of this file exist because guessing was not good enough. A
   browser can report WebGL2 and then fail to render into a float texture, which
   is the one capability the whole simulation stands on; and a browser can
   support every extension and still be a software rasteriser drawing at three
   frames a second, which no extension string will tell you. So the formats are
   detected by allocating one and asking whether it worked, and the speed is
   detected by timing the frames and stepping down. */

export type Capability = {
  /* What the simulation textures can be rendered into. Full float where it is
     available, half float where it is not, which is the specification's own
     order and matters: half float has about three decimal digits, and particle
     positions live in nought to one, so the error is under a thousandth of the
     brain's width. Visible as a shimmer only if you go looking. */
  simInternal: number;
  simFormat: number;
  simType: number;
  /* What the post chain accumulates into. Half float throughout: the bright
     pass needs values above one to have anything to find, and a full float
     chain at viewport size costs twice the bandwidth for no visible gain. */
  hdrInternal: number;
  hdrType: number;
  maxTextureSize: number;
  vertexTextureUnits: number;
  renderer: string;
};

/* Ask for the format rather than trust the extension string. An extension can
   be present and the format still not be colour renderable on the driver
   underneath, and the failure mode is a black screen with no error. */
function renderable(gl: WebGL2RenderingContext, internalFormat: number, type: number) {
  const target = createTarget(gl, {
    width: 4,
    height: 4,
    internalFormat,
    format: gl.RGBA,
    type,
    label: "capability probe",
  });
  if (!target) return false;
  disposeTarget(gl, target);
  return true;
}

export function detectCapability(gl: WebGL2RenderingContext): Capability | null {
  /* In WebGL2 this one extension is what makes both the full float and the half
     float colour attachments renderable. Without it there is no simulation to
     run, and the engine falls back to a still picture. */
  const colourBufferFloat = gl.getExtension("EXT_color_buffer_float");
  const colourBufferHalf = gl.getExtension("EXT_color_buffer_half_float");
  if (!colourBufferFloat && !colourBufferHalf) return null;

  const full = colourBufferFloat && renderable(gl, gl.RGBA32F, gl.FLOAT);
  const half = renderable(gl, gl.RGBA16F, gl.HALF_FLOAT);
  if (!full && !half) return null;

  const vertexTextureUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) as number;
  /* The vertex shader reads position, scale and colour from textures. A machine
     that cannot sample a texture in the vertex stage cannot run this at all,
     and the guaranteed floor in the specification is zero, so it is worth
     asking rather than assuming. */
  if (vertexTextureUnits < 4) return null;

  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(
    debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
  );

  return {
    simInternal: full ? gl.RGBA32F : gl.RGBA16F,
    simFormat: gl.RGBA,
    simType: full ? gl.FLOAT : gl.HALF_FLOAT,
    hdrInternal: half ? gl.RGBA16F : gl.RGBA32F,
    hdrType: half ? gl.HALF_FLOAT : gl.FLOAT,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    vertexTextureUnits,
    renderer,
  };
}

export type Tier = {
  level: QualityLevel;
  instances: number;
  post: PostLevel;
  /* The specification prefers one on desktop, where the post chain is doing the
     expensive work, and allows more on a phone, where it is not. That is the
     opposite of the usual advice and it is right here for that reason. */
  pixelRatio: number;
};

/* How many of the generated particles each tier actually draws. The cloud is
   built once at the grid's full size and the tier takes a shuffled prefix of
   it, so a lower tier gets an even sample of the whole brain rather than
   whichever end of the index happened to come first. */
const DESKTOP: Record<QualityLevel, Omit<Tier, "pixelRatio">> = {
  high: { level: "high", instances: 32400, post: "full" },
  medium: { level: "medium", instances: 14000, post: "bloom" },
  low: { level: "low", instances: 6000, post: "minimal" },
};

const MOBILE: Record<QualityLevel, Omit<Tier, "pixelRatio">> = {
  high: { level: "high", instances: 14400, post: "bloom" },
  medium: { level: "medium", instances: 7000, post: "bloom" },
  low: { level: "low", instances: 3500, post: "minimal" },
};

export function isMobile() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || window.innerWidth < 760;
}

export function tierFor(level: QualityLevel, mobile: boolean): Tier {
  const base = mobile ? MOBILE[level] : DESKTOP[level];
  const ratio = mobile ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  return { ...base, pixelRatio: level === "high" ? ratio : Math.min(ratio, 1) };
}

/* Where to start before any frame has been timed. Deliberately not clever: the
   frame timer below is the real measurement, and this only decides how long the
   machine spends finding out. A software rasteriser names itself, and starting
   it at high costs a second of stutter before the timer catches up. */
export function initialLevel(capability: Capability, mobile: boolean): QualityLevel {
  const software = /swiftshader|llvmpipe|software|microsoft basic/i.test(capability.renderer);
  if (software) return "low";

  const cores = navigator.hardwareConcurrency ?? 4;
  if (mobile) return cores >= 6 ? "high" : "medium";
  return cores >= 4 ? "high" : "medium";
}

/* Frame times, and the decision to step down.

   Two things keep this from oscillating. It needs a sustained window rather
   than a run of bad frames, so one long garbage collection does not cost a
   quality level. And it will only ever step up once, and never after it has
   stepped down: a machine that has already proved it cannot hold a level does
   not get asked again, because the alternative is a page that changes quality
   every few seconds forever. */
const WINDOW = 90;
const DOWN_MS = 1000 / 42;
const UP_MS = 1000 / 56;
/* The first frames include shader compilation and the first upload of every
   texture, which is not what steady state costs. */
const WARMUP = 20;

export function createFrameWatch(start: QualityLevel) {
  let level = start;
  let seen = 0;
  let total = 0;
  let steppedDown = false;
  let steppedUp = false;
  let last = 0;

  return {
    get level() {
      return level;
    },
    get averageMs() {
      return seen > 0 ? total / seen : 0;
    },
    reset() {
      seen = 0;
      total = 0;
      last = 0;
    },
    /* Returns the new level when it changes, and null when it does not. */
    sample(nowMs: number): QualityLevel | null {
      if (last === 0) {
        last = nowMs;
        return null;
      }
      const elapsed = nowMs - last;
      last = nowMs;

      seen += 1;
      if (seen <= WARMUP) return null;
      total += elapsed;

      if (seen < WARMUP + WINDOW) return null;
      const average = total / (seen - WARMUP);
      seen = WARMUP;
      total = 0;

      if (average > DOWN_MS && level !== "low") {
        level = level === "high" ? "medium" : "low";
        steppedDown = true;
        return level;
      }
      if (average < UP_MS && !steppedDown && !steppedUp && level !== "high") {
        level = level === "low" ? "medium" : "high";
        steppedUp = true;
        return level;
      }
      return null;
    },
  };
}

/* A query string can force a level, which is how the tests exercise the high
   path on a machine that would otherwise be stepped straight down to low, and
   how a slow machine can be asked for the full picture on purpose. It is
   harmless in production: nobody arrives at this site with it set by accident. */
export function forcedLevel(): QualityLevel | "off" | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("brainQuality");
  if (value === "high" || value === "medium" || value === "low" || value === "off") return value;
  return null;
}

export function debugRequested() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("brainDebug") === "1";
}
