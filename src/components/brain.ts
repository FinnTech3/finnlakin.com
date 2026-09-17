import { readTints, type Vec } from "./particles";

/* The brain: a point cloud on the surface of a three dimensional brain, drawn
   in WebGL.

   It has been through two wrong implementations, and the reason both looked
   wrong is worth keeping. The first traced an outline and its folds as flat
   curves, which reads as a diagram. The second put the points in three
   dimensions but drew them by stamping sprites onto a 2D canvas, which caps the
   count at a few thousand before the frame cost bites and gives every particle
   a hollow outline. Hollow outlines at low density read as a sketch.

   What the reference actually does, and what this does now: tens of thousands
   of small filled particles, blended additively, so that density becomes
   brightness on its own. The bloom in that picture is not a post effect, it is
   thousands of translucent particles overlapping. Additive blending is also
   order independent, which means no depth sort at all: the whole per frame cost
   is one draw call. */

const POINTS_WIDE = 34000;
const POINTS_NARROW = 12000;
const CEREBELLUM_SHARE = 0.09;
/* Loose particles drifting around the mass, as in the reference. */
const AMBIENT_SHARE = 0.05;

const TINT_TOKENS = ["--spark", "--bone", "--iris", "--verdant"];
const TINT_FALLBACKS = ["#ffb829", "#ffffff", "#926aff", "#189b81"];
/* Amber dominant, white second, violet and teal as punctuation. Read off the
   reference's own hero image: the palette document lists the brand colours but
   not their proportions, and the proportions are most of the look. */
const TINT_WEIGHTS = [0.64, 0.19, 0.1, 0.07];

const DISTANCE = 3.5;
const FOCAL = 1.05;

export type Brain = {
  layout: (width: number, height: number) => void;
  draw: (seconds: number, pointer: Vec | null, scroll: number, settle: boolean) => void;
  clear: () => void;
  count: () => number;
};

const VERTEX = `#version 300 es
in vec3 a_pos;
/* ridge, tint index, size */
in vec3 a_meta;

uniform float u_yaw;
uniform float u_pitch;
uniform float u_distance;
uniform float u_focal;
uniform float u_scale;
uniform vec2 u_resolution;
uniform vec3 u_tints[4];

out vec3 v_tint;
out float v_alpha;

void main() {
  float cy = cos(u_yaw), sy = sin(u_yaw);
  float cp = cos(u_pitch), sp = sin(u_pitch);

  float rx = a_pos.x * cy + a_pos.z * sy;
  float rz = -a_pos.x * sy + a_pos.z * cy;
  float ry = a_pos.y * cp - rz * sp;
  rz = a_pos.y * sp + rz * cp;

  float depth = max(0.35, u_distance - rz);
  vec2 screen = vec2(rx, ry) * u_focal / depth;
  gl_Position = vec4(screen / (u_resolution * 0.5), 0.0, 1.0);

  float ridge = a_meta.x;
  gl_PointSize = a_meta.z * u_scale * (3.1 / depth) * (0.5 + ridge * 0.95);

  int index = int(a_meta.y + 0.5);
  v_tint = u_tints[index];

  /* Nearer is brighter, and a point on the crest of a fold is brighter than one
     down in a sulcus. Both are what stop the cloud reading as a flat shell. */
  float nearness = clamp((rz + 1.15) / 2.3, 0.0, 1.0);
  v_alpha = (0.14 + nearness * nearness * 0.78) * (0.14 + ridge * ridge * 0.95);
}
`;

const FRAGMENT = `#version 300 es
precision mediump float;

in vec3 v_tint;
in float v_alpha;
out vec4 fragColor;

void main() {
  /* A filled triangle inside the point sprite, brighter towards its edge. The
     previous version stroked a hollow outline, which is what made the cloud
     look drawn rather than lit. */
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;

  float edge = max(-0.5 - q.y, max(0.866 * q.x + 0.5 * q.y - 0.5, -0.866 * q.x + 0.5 * q.y - 0.5));
  float fill = smoothstep(0.08, -0.06, edge);
  if (fill <= 0.001) discard;

  float rim = smoothstep(-0.5, -0.02, edge);
  float alpha = v_alpha * fill;
  vec3 colour = v_tint * (0.55 + rim * 0.95);

  /* Premultiplied, so the blend can be a straight add. */
  fragColor = vec4(colour * alpha, alpha);
}
`;

function noise(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function tintFor(random: number) {
  let cumulative = 0;
  for (let i = 0; i < TINT_WEIGHTS.length; i++) {
    cumulative += TINT_WEIGHTS[i]!;
    if (random < cumulative) return i;
  }
  return 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
}

/* The cortical surface, as a displaced ellipsoid.

   Points come off a Fibonacci sphere, which covers evenly with no crowding at
   the poles, and the ellipsoid is then pushed into a brain: flat underneath, a
   temporal lobe cut away from the rest by a deep lateral sulcus, a tapered
   occipital pole, a groove down the midline, and folds displacing the surface
   along its normal.

   The fold phase is kept after it has moved the point, because it decides
   whether that point sits on a crest or in a valley, and that drives size,
   brightness and whether the point survives at all. Thinning the valleys rather
   than merely dimming them is what separates a folded surface from a shell. */
function buildCloud(target: number): Float32Array {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ambient = Math.round(target * AMBIENT_SHARE);
  const cerebellum = Math.round(target * CEREBELLUM_SHARE);
  const cortex = target - ambient - cerebellum;

  const data = new Float32Array(target * 6);
  let n = 0;

  const push = (x: number, y: number, z: number, ridge: number, index: number, size: number) => {
    const at = n * 6;
    data[at] = x;
    data[at + 1] = y;
    data[at + 2] = z;
    data[at + 3] = ridge;
    data[at + 4] = tintFor(noise(index, 7));
    data[at + 5] = size;
    n += 1;
  };

  for (let i = 0; i < cortex; i++) {
    const unit = 1 - (i / Math.max(1, cortex - 1)) * 2;
    const band = Math.sqrt(Math.max(0, 1 - unit * unit));
    const angle = golden * i;

    /* Negative x so the frontal pole faces left, the way the reference sits. */
    let px = -Math.cos(angle) * band * 1.34;
    let py = unit * 0.84;
    let pz = Math.sin(angle) * band * 0.72;

    if (py < 0) py *= 0.52 + 0.48 * Math.min(1, Math.abs(px));

    /* The temporal lobe, and the lateral sulcus that separates it. Without the
       sulcus the underside is one smooth mass and the silhouette loses the
       thing that most says "brain". */
    const temporal = Math.exp(-((px + 0.28) ** 2 * 2.4 + (py + 0.42) ** 2 * 5.2));
    py -= temporal * 0.24;
    pz *= 1 + temporal * 0.12;
    const sulcus = Math.exp(-((py + 0.2) ** 2 * 60 + (px + 0.1) ** 2 * 0.9));
    py += sulcus * 0.05;

    const back = Math.max(0, (px - 0.55) / 0.8);
    py *= 1 - back * 0.17;
    pz *= 1 - back * 0.15;

    const front = Math.max(0, (-px - 0.72) / 0.7);
    pz *= 1 - front * 0.13;

    const phase =
      Math.sin(px * 5.4 + pz * 2.2) * 0.55 +
      Math.sin(py * 6.4 + px * 2.7) * 0.3 +
      Math.sin(pz * 7.6 + py * 3.3) * 0.15;
    const length = Math.hypot(px, py, pz) || 1;
    const displacement = phase * 0.09;
    px += (px / length) * displacement;
    py += (py / length) * displacement;
    pz += (pz / length) * displacement;

    py -= Math.exp(-(pz * pz) * 45) * Math.max(0, py) * 0.17;

    px += (noise(i, 1) - 0.5) * 0.02;
    py += (noise(i, 2) - 0.5) * 0.02;
    pz += (noise(i, 3) - 0.5) * 0.02;

    const crest = (phase + 1) / 2;
    if (noise(i, 8) > 0.46 + crest * 0.62) continue;
    push(px, py, pz, crest, i, 3.0 + noise(i, 6) * 3.4);
  }

  for (let i = 0; i < cerebellum; i++) {
    const unit = 1 - (i / Math.max(1, cerebellum - 1)) * 2;
    const band = Math.sqrt(Math.max(0, 1 - unit * unit));
    const angle = golden * i;
    const px = Math.cos(angle) * band * 0.31;
    const py = unit * 0.19;
    const pz = Math.sin(angle) * band * 0.27;
    const phase = Math.sin(px * 34) * Math.sin(py * 30);
    push(
      px + 0.93 + phase * 0.018,
      py - 0.52 + phase * 0.018,
      pz,
      (phase + 1) / 2,
      i + 20000,
      2.0 + noise(i, 9) * 1.7,
    );
  }

  /* Loose particles around the mass, larger and sparser, which is what gives
     the reference its sense of the cloud extending past its own edge. */
  for (let i = 0; i < ambient; i++) {
    const a = noise(i, 11) * Math.PI * 2;
    const b = Math.acos(2 * noise(i, 12) - 1);
    const r = 1.25 + noise(i, 13) * 1.15;
    push(
      Math.sin(b) * Math.cos(a) * r * 1.3,
      Math.cos(b) * r * 0.75,
      Math.sin(b) * Math.sin(a) * r * 0.8,
      0.55 + noise(i, 14) * 0.45,
      i + 40000,
      3.2 + noise(i, 15) * 4.5,
    );
  }

  return data.subarray(0, n * 6);
}

export function createBrain(canvas: HTMLCanvasElement): Brain | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const context = gl;

  const compile = (type: number, source: string) => {
    const shader = context.createShader(type);
    if (!shader) return null;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      context.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertex = compile(context.VERTEX_SHADER, VERTEX);
  const fragment = compile(context.FRAGMENT_SHADER, FRAGMENT);
  const program = vertex && fragment ? context.createProgram() : null;
  if (!vertex || !fragment || !program) return null;

  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) return null;
  context.useProgram(program);

  const buffer = context.createBuffer();
  const stride = 6 * 4;
  const posLocation = context.getAttribLocation(program, "a_pos");
  const metaLocation = context.getAttribLocation(program, "a_meta");

  const uniform = (name: string) => context.getUniformLocation(program, name);
  const uYaw = uniform("u_yaw");
  const uPitch = uniform("u_pitch");
  const uDistance = uniform("u_distance");
  const uFocal = uniform("u_focal");
  const uScale = uniform("u_scale");
  const uResolution = uniform("u_resolution");

  const tints = readTints(TINT_TOKENS, TINT_FALLBACKS).map(hexToRgb);
  const flat = new Float32Array(12);
  tints.forEach((tint, i) => flat.set(tint, i * 3));
  context.uniform3fv(uniform("u_tints"), flat);
  context.uniform1f(uDistance, DISTANCE);

  /* Additive, premultiplied. Density becomes brightness, and because addition
     commutes there is nothing to sort. */
  context.disable(context.DEPTH_TEST);
  context.enable(context.BLEND);
  context.blendFunc(context.ONE, context.ONE);

  let points = 0;
  let built = 0;
  let scale = 1;

  function layout(cssWidth: number, cssHeight: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round(cssWidth * dpr));
    const height = Math.max(2, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.viewport(0, 0, width, height);
    context.uniform2f(uResolution, width, height);
    context.uniform1f(uFocal, Math.min(width, height * 1.5) * FOCAL);
    scale = dpr;

    /* The cloud is in model space, so a resize only changes the projection. It
       is rebuilt when the breakpoint changes the target count, and not
       otherwise: thirty four thousand points is not work to repeat on every
       resize event. */
    const target = cssWidth < 560 ? POINTS_NARROW : POINTS_WIDE;
    if (target !== built) {
      built = target;
      const data = buildCloud(target);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW);
      context.enableVertexAttribArray(posLocation);
      context.vertexAttribPointer(posLocation, 3, context.FLOAT, false, stride, 0);
      context.enableVertexAttribArray(metaLocation);
      context.vertexAttribPointer(metaLocation, 3, context.FLOAT, false, stride, 3 * 4);
      points = data.length / 6;
    }
  }

  function draw(seconds: number, pointer: Vec | null, scroll: number, settle: boolean) {
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
    if (points === 0) return;

    /* Three things turn it, and they add rather than compete: a slow idle
       drift, the scroll position, and the pointer. */
    const drift = settle ? 0 : Math.sin(seconds * 0.15) * 0.11;
    const yaw = -0.28 + drift + scroll * 0.8 + (pointer ? pointer.x * 0.3 : 0);
    const pitch = -0.07 - scroll * 0.16 + (pointer ? pointer.y * 0.22 : 0);

    context.uniform1f(uYaw, yaw);
    context.uniform1f(uPitch, pitch);
    context.uniform1f(uScale, scale);
    context.drawArrays(context.POINTS, 0, points);
  }

  return {
    layout,
    draw,
    clear: () => {
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);
    },
    count: () => points,
  };
}
