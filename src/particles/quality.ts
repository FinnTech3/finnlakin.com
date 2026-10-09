import { createTarget, disposeTarget } from "./gl";
import type { PostLevel, QualityLevel } from "./types";

/* What the machine can actually do, and what to ask of it.

   Both halves of this file exist because guessing was not good enough. A
   browser can report WebGL2 and then fail to render into a float texture, which
   is the one capability the whole simulation stands on; and a browser can
   support every extension and still be a software rasteriser drawing at three
   frames a second, which no extension string will tell you. So the formats are
   detected by allocating one and asking whether it worked, and the speed is
   detected by timing the frames and stepping down, which the page's frame
   scheduler in particles/frame.ts does for everything on the page at once. */

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

const COMPACT: Record<QualityLevel, Omit<Tier, "pixelRatio">> = {
  high: { level: "high", instances: 14400, post: "bloom" },
  medium: { level: "medium", instances: 7000, post: "bloom" },
  low: { level: "low", instances: 3500, post: "minimal" },
};

/* What kind of screen this is, as two questions that used to be one.

   There was a single "is this a phone" test, a coarse pointer or a narrow
   window, and it decided everything at once: how many particles to build, how
   large to draw the cloud, how to turn each pyramid, how fast to morph, and
   whether to listen for a mouse. A tablet has a coarse pointer, so every iPad
   was a phone, and on one held in landscape, which has a lane beside the
   content exactly as a laptop does, the cloud came out a sixth of the height of
   the screen where a laptop's is over a third of it: measured, 127 pixels tall
   in a window 820 tall against the 300 odd it should have been.

   The two questions are not the same question and do not have the same answer
   on every machine:

   - `compact` is whether the screen is small, which is what decides how much
     there is room for and so how much to build and draw. It is the shorter side
     of the window, so a phone held either way up is compact and a tablet held
     either way up is not.
   - `touch` is whether the main way of pointing is a finger, which is what
     decides whether there is a hover to part the cloud around and how far one
     frame's worth of pointer movement can be trusted.

   How large the cloud is drawn is neither: it is the layout's to say, and it is
   read off the page in timeline.ts. */
export type Device = {
  compact: boolean;
  touch: boolean;
};

/* The shorter side of the window below which the screen is compact, in CSS
   pixels. The smallest tablets are 744 on their short side and the largest
   phones 440 on theirs, held either way up, so the line is between them. A
   desktop window dragged narrow is a small screen for as long as it is narrow,
   which is also right. */
const COMPACT_BELOW = 600;

export function detectDevice(): Device {
  if (typeof window === "undefined") return { compact: false, touch: false };
  /* The main pointer is a finger and nothing finer is attached. A tablet in a
     keyboard case has a trackpad as well, and for as long as it is there that
     is a pointer machine: the page can part the cloud around it, and its
     movements can be trusted as a mouse's are. */
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const finerToo = window.matchMedia?.("(any-pointer: fine)").matches ?? false;
  const touch = coarse && !finerToo;
  const compact = Math.min(window.innerWidth, window.innerHeight) < COMPACT_BELOW;
  return { compact, touch };
}

export function tierFor(level: QualityLevel, device: Device): Tier {
  const base = device.compact ? COMPACT[level] : DESKTOP[level];
  /* Drawn in the screen's own pixels on a touch screen, up to two to a pixel,
     and in CSS pixels everywhere else: a soft cloud costs nothing to upscale,
     and a pointer machine's graphics are spending their effort elsewhere. */
  const ratio = device.touch ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  /* The depth of field is the expensive pass and it is for a machine with a
     card to spend on it. A tablet draws a full size cloud and has bloom. */
  const post = device.touch && base.post === "full" ? "bloom" : base.post;
  return { ...base, post, pixelRatio: level === "high" ? ratio : Math.min(ratio, 1) };
}

/* Where to start before any frame has been timed. Deliberately not clever: the
   frame timer below is the real measurement, and this only decides how long the
   machine spends finding out. A software rasteriser names itself, and starting
   it at high costs a second of stutter before the timer catches up.

   A tablet draws the full size cloud, which is more than a phone does, so it
   asks for more cores before starting at the top and otherwise starts a step
   down and lets the page's ladder bring it up if it can keep up. */
export function initialLevel(capability: Capability, device: Device): QualityLevel {
  const software = /swiftshader|llvmpipe|software|microsoft basic/i.test(capability.renderer);
  if (software) return "low";

  const cores = navigator.hardwareConcurrency ?? 4;
  if (device.compact) return cores >= 6 ? "high" : "medium";
  if (device.touch) return cores >= 8 ? "high" : "medium";
  return cores >= 4 ? "high" : "medium";
}

/* Frame times, and the decision to step down, used to live here as a watch the
   engine sampled every frame. It is in particles/frame.ts now, as the last
   rung of one ladder for the whole page, because a watch that only saw the
   brain could not know there was a cheaper thing on the page to give up
   first. The rules it kept are the same: a sustained window rather than a run
   of bad frames, one step up at most, and never after a step down. */

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

/* The readout of frame rate and quality, for a device nobody has here. */
export function statsRequested() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("brainStats") === "1";
}
