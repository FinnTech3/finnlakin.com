import { readTints, type Vec } from "./particles";

/* The constellation: a brain as a cloud of small triangles in three dimensions.

   The first version of this was flat. It traced a brain outline and its folds
   as two dimensional curves and sampled them into particles, which reads as a
   diagram. The reference is not a diagram: it is a point cloud on the surface
   of a three dimensional brain, seen in perspective, with the near face bright
   and dense and the far face dim and sparse. That difference is not a matter of
   tuning, so this was rebuilt rather than adjusted.

   It is drawn on a 2D canvas rather than in WebGL. The site the reference comes
   from uses WebGL with instanced geometry, which is the right tool at this
   particle count; a library to do it here would cost more than the entire
   JavaScript budget this site holds itself to. What is here instead is a hand
   rolled projection: rotate, project, sort by depth, stamp a sprite. It is
   honest about its limit, which is the particle count, and it carries a guard
   that stops it if the machine cannot keep up. */

/* Points on the cortical surface. Cut down on a small screen, where the cloud
   is a fraction of the size and nobody can see the difference. */
const POINTS_WIDE = 9000;
const POINTS_NARROW = 3600;
const CEREBELLUM_SHARE = 0.16;

/* Depth buckets for ordering the draw. A comparison sort of nine thousand
   entries every frame is affordable but wasteful; this is linear and the
   ordering only has to be right to within a bucket for sprites this small. */
const BUCKETS = 96;

const SPRITE = 10;

/* Amber dominant, white second, violet and teal as punctuation. Taken from the
   reference's own hero image rather than from the palette document, which lists
   the brand colours but not their proportions. */
const TINT_TOKENS = ["--spark", "--bone", "--iris", "--verdant"];
const TINT_FALLBACKS = ["#ffb829", "#ffffff", "#926aff", "#189b81"];
const TINT_WEIGHTS = [0.62, 0.2, 0.1, 0.08];

/* Camera. */
const DISTANCE = 3.5;
const FOCAL = 0.95;

export type Brain = {
  layout: (width: number, height: number) => void;
  draw: (seconds: number, pointer: Vec | null, scroll: number, settle: boolean) => void;
  clear: () => void;
  count: () => number;
};

/* Deterministic per-index noise. A point keeps its colour, its jitter and its
   size for the life of the page without any of that having to be stored. */
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

function buildSprites(tints: string[]): HTMLCanvasElement[] {
  return tints.map((tint) => {
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE;
    sprite.height = SPRITE;
    const ctx = sprite.getContext("2d");
    if (!ctx) return sprite;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1.1;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(SPRITE / 2, 1.2);
    ctx.lineTo(SPRITE - 1, SPRITE - 1.4);
    ctx.lineTo(1, SPRITE - 1.4);
    ctx.closePath();
    ctx.stroke();
    return sprite;
  });
}

type Cloud = {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /* How far out of a fold a point sits, nought in the depth of a sulcus and one
     on the crest of a gyrus. It drives size and brightness, and it is what makes
     the surface read as folded rather than as a solid mass. */
  ridge: Float32Array;
  tint: Uint8Array;
  size: Float32Array;
  count: number;
};

/* The cortical surface, as a displaced ellipsoid.

   Points come off a Fibonacci sphere, which covers evenly with no crowding at
   the poles, then the ellipsoid is pushed into a brain: flat underneath, a
   temporal bulge low and forward, a tapered occipital pole at the back, a
   groove down the midline, and folds displacing the surface along its normal.

   Points deep in a sulcus are thinned out rather than merely dimmed. That is
   what separates this from a solid shell of triangles. */
function buildCloud(target: number): Cloud {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cortex = Math.round(target * (1 - CEREBELLUM_SHARE));
  const cerebellum = target - cortex;

  const x = new Float32Array(target);
  const y = new Float32Array(target);
  const z = new Float32Array(target);
  const ridge = new Float32Array(target);
  const tint = new Uint8Array(target);
  const size = new Float32Array(target);
  let count = 0;

  const keep = (px: number, py: number, pz: number, crest: number, index: number) => {
    x[count] = px;
    y[count] = py;
    z[count] = pz;
    ridge[count] = crest;
    tint[count] = tintFor(noise(index, 7));
    size[count] = 0.8 + noise(index, 6) * 0.4;
    count += 1;
  };

  for (let i = 0; i < cortex; i++) {
    const unit = 1 - (i / Math.max(1, cortex - 1)) * 2;
    const band = Math.sqrt(Math.max(0, 1 - unit * unit));
    const angle = golden * i;

    /* Negative x so the frontal pole faces left, the way the reference sits. */
    let px = -Math.cos(angle) * band * 1.32;
    let py = unit * 0.82;
    let pz = Math.sin(angle) * band * 0.7;

    if (py < 0) py *= 0.55 + 0.45 * Math.min(1, Math.abs(px));

    const temporal = Math.exp(-((px + 0.3) ** 2 * 2.6 + (py + 0.4) ** 2 * 5.5));
    py -= temporal * 0.22;
    pz *= 1 + temporal * 0.1;

    const back = Math.max(0, (px - 0.55) / 0.8);
    py *= 1 - back * 0.16;
    pz *= 1 - back * 0.14;

    const front = Math.max(0, (-px - 0.7) / 0.7);
    pz *= 1 - front * 0.12;

    const phase =
      Math.sin(px * 5.2 + pz * 2.1) * 0.55 +
      Math.sin(py * 6.2 + px * 2.6) * 0.3 +
      Math.sin(pz * 7.4 + py * 3.2) * 0.15;
    const length = Math.hypot(px, py, pz) || 1;
    const displacement = phase * 0.085;
    px += (px / length) * displacement;
    py += (py / length) * displacement;
    pz += (pz / length) * displacement;

    /* The longitudinal fissure, down the midline on top. */
    py -= Math.exp(-(pz * pz) * 45) * Math.max(0, py) * 0.16;

    px += (noise(i, 1) - 0.5) * 0.022;
    py += (noise(i, 2) - 0.5) * 0.022;
    pz += (noise(i, 3) - 0.5) * 0.022;

    const crest = (phase + 1) / 2;
    if (noise(i, 8) > 0.3 + crest * 0.8) continue;
    keep(px, py, pz, crest, i);
  }

  /* The cerebellum, its own denser cluster behind and below, with a finer
     texture than the cortex. */
  for (let i = 0; i < cerebellum; i++) {
    const unit = 1 - (i / Math.max(1, cerebellum - 1)) * 2;
    const band = Math.sqrt(Math.max(0, 1 - unit * unit));
    const angle = golden * i;
    const px = Math.cos(angle) * band * 0.32;
    const py = unit * 0.2;
    const pz = Math.sin(angle) * band * 0.28;
    const phase = Math.sin(px * 30) * Math.sin(py * 26);
    keep(px + 0.92 + phase * 0.02, py - 0.5 + phase * 0.02, pz, (phase + 1) / 2, i + 20000);
  }

  return { x, y, z, ridge, tint, size, count };
}

export function createBrain(canvas: HTMLCanvasElement): Brain | null {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  const ctx = context;

  const sprites = buildSprites(readTints(TINT_TOKENS, TINT_FALLBACKS));

  let cloud: Cloud | null = null;
  let scale = 1;
  let centreX = 0;
  let centreY = 0;
  let focal = 600;

  /* Reused every frame. Allocating these per frame is what turns a smooth
     animation into a sawtooth of garbage collections. */
  let rx = new Float32Array(0);
  let ry = new Float32Array(0);
  let rz = new Float32Array(0);
  let order = new Int32Array(0);
  let bucketCount = new Int32Array(BUCKETS);
  let bucketStart = new Int32Array(BUCKETS);

  function layout(cssWidth: number, cssHeight: number) {
    const longEdge = Math.max(cssWidth, cssHeight, 1);
    scale = Math.min(window.devicePixelRatio || 1, 1400 / longEdge);
    const width = Math.max(2, Math.round(cssWidth * scale));
    const height = Math.max(2, Math.round(cssHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    centreX = width / 2;
    centreY = height * 0.47;
    focal = Math.min(width, height * 1.5) * FOCAL;

    const target = cssWidth < 560 ? POINTS_NARROW : POINTS_WIDE;
    if (!cloud || cloud.x.length !== target) {
      cloud = buildCloud(target);
      rx = new Float32Array(cloud.count);
      ry = new Float32Array(cloud.count);
      rz = new Float32Array(cloud.count);
      order = new Int32Array(cloud.count);
      bucketCount = new Int32Array(BUCKETS);
      bucketStart = new Int32Array(BUCKETS);
    }
  }

  function draw(seconds: number, pointer: Vec | null, scroll: number, settle: boolean) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!cloud) return;
    const { x, y, z, ridge, tint, size, count } = cloud;

    /* Three things turn the cloud, and they add rather than compete: a slow
       idle drift, the scroll position, and the pointer. Scroll is the parallax
       the reference has, and it is the reason the cloud is worth having on a
       page somebody scrolls. */
    const drift = settle ? 0 : Math.sin(seconds * 0.16) * 0.1;
    const yaw = -0.3 + drift + scroll * 0.85 + (pointer ? pointer.x * 0.28 : 0);
    const pitch = -0.08 - scroll * 0.18 + (pointer ? pointer.y * 0.2 : 0);

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    let near = Infinity;
    let far = -Infinity;
    for (let i = 0; i < count; i++) {
      const px = x[i]!;
      const py = y[i]!;
      const pz = z[i]!;
      const ax = px * cosYaw + pz * sinYaw;
      let az = -px * sinYaw + pz * cosYaw;
      const ay = py * cosPitch - az * sinPitch;
      az = py * sinPitch + az * cosPitch;
      rx[i] = ax;
      ry[i] = ay;
      rz[i] = az;
      if (az < near) near = az;
      if (az > far) far = az;
    }

    /* Counting sort into depth buckets: linear, and precise enough that two
       sprites ten pixels across never visibly swap. */
    const span = Math.max(1e-6, far - near);
    bucketCount.fill(0);
    for (let i = 0; i < count; i++) {
      const bucket = Math.min(BUCKETS - 1, ((rz[i]! - near) / span * BUCKETS) | 0);
      bucketCount[bucket]! += 1;
    }
    let running = 0;
    for (let b = 0; b < BUCKETS; b++) {
      bucketStart[b] = running;
      running += bucketCount[b]!;
    }
    for (let i = 0; i < count; i++) {
      const bucket = Math.min(BUCKETS - 1, ((rz[i]! - near) / span * BUCKETS) | 0);
      order[bucketStart[bucket]!] = i;
      bucketStart[bucket]! += 1;
    }

    for (let k = 0; k < count; k++) {
      const i = order[k]!;
      const depth = DISTANCE - rz[i]!;
      const sx = centreX + (rx[i]! * focal) / depth;
      const sy = centreY - (ry[i]! * focal) / depth;
      const nearness = (rz[i]! - near) / span;
      const crest = ridge[i]!;
      const width = SPRITE * (0.5 + nearness * 0.8) * (0.7 + crest * 0.55) * size[i]!;
      ctx.globalAlpha = (0.2 + nearness * 0.7) * (0.4 + crest * 0.6);
      ctx.drawImage(sprites[tint[i]!]!, sx - width / 2, sy - width / 2, width, width);
    }
    ctx.globalAlpha = 1;
  }

  return {
    layout,
    draw,
    clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    count: () => cloud?.count ?? 0,
  };
}
