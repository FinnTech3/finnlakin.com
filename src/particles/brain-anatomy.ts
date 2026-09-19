import { BRAIN_PROFILE, PROFILE_HALF_HEIGHT } from "./brain-profile";
import { clamp } from "./pack";

/* The brain's shape, swept from a traced outline.

   Three attempts were made at inventing this silhouette. A Fibonacci sphere
   displaced by sine waves, then a blend of ellipsoids with a capsule subtracted
   for the lateral sulcus. Both produced a smooth loaf, and the reason is the
   same both times: a brain's outline is not smooth. It is bumpy with gyri, the
   frontal pole bulges forward, the occipital comes to a blunt point, and the
   temporal lobe hangs as a distinct hook below a deep notch. Those are the
   features a person recognises, and none of them survives being approximated by
   a quadric.

   So the outline is not invented any more. brain-profile.ts holds ninety two
   points traced off plate 728 of Gray's Anatomy, which is out of copyright, and
   this sweeps that profile into a solid. The silhouette from the side is then
   exactly the plate's, bumps and all, which is the only way it was ever going
   to be right.

   Model units: half length one, origin at the middle of the outline, y up, and
   the frontal pole towards negative x. */

/* --- the traced profile, as a distance field ----------------------------- */

/* The exact polygon distance is ninety two segments per sample, and the sampler
   asks for it a few hundred thousand times. So it is evaluated once onto a grid
   and read back bilinearly: about thirty milliseconds to build, and a handful
   of operations per sample afterwards. */
const GRID_W = 320;
const GRID_H = 240;
const GRID_MIN_X = -1.3;
const GRID_MAX_X = 1.3;
const GRID_MIN_Y = -1.0;
const GRID_MAX_Y = 1.0;

let grid: Float32Array | null = null;

function exactProfileDistance(px: number, py: number) {
  const points = BRAIN_PROFILE;
  const count = points.length;
  let nearest = Infinity;
  let sign = 1;

  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const [ix, iy] = points[i]!;
    const [jx, jy] = points[j]!;
    const ex = jx - ix;
    const ey = jy - iy;
    const wx = px - ix;
    const wy = py - iy;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1), 0, 1);
    const bx = wx - ex * t;
    const by = wy - ey * t;
    nearest = Math.min(nearest, bx * bx + by * by);

    /* Winding, by counting crossings of the horizontal ray. */
    const above = py >= iy;
    const below = py < jy;
    const leftOf = ex * wy > ey * wx;
    if ((above && below && leftOf) || (!above && !below && !leftOf)) sign = -sign;
  }

  return sign * Math.sqrt(nearest);
}

function buildGrid() {
  const out = new Float32Array(GRID_W * GRID_H);
  for (let gy = 0; gy < GRID_H; gy += 1) {
    const y = GRID_MIN_Y + ((GRID_MAX_Y - GRID_MIN_Y) * gy) / (GRID_H - 1);
    for (let gx = 0; gx < GRID_W; gx += 1) {
      const x = GRID_MIN_X + ((GRID_MAX_X - GRID_MIN_X) * gx) / (GRID_W - 1);
      out[gy * GRID_W + gx] = exactProfileDistance(x, y);
    }
  }
  return out;
}

export function profileDistance(px: number, py: number): number {
  if (!grid) grid = buildGrid();
  const fx = ((px - GRID_MIN_X) / (GRID_MAX_X - GRID_MIN_X)) * (GRID_W - 1);
  const fy = ((py - GRID_MIN_Y) / (GRID_MAX_Y - GRID_MIN_Y)) * (GRID_H - 1);
  if (fx < 0 || fy < 0 || fx > GRID_W - 1 || fy > GRID_H - 1) {
    /* Outside the grid is outside the brain, and how far outside only has to be
       monotonic for the sampler to reject it. */
    return Math.hypot(px, py);
  }
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(GRID_W - 1, x0 + 1);
  const y1 = Math.min(GRID_H - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = grid[y0 * GRID_W + x0]!;
  const b = grid[y0 * GRID_W + x1]!;
  const c = grid[y1 * GRID_W + x0]!;
  const d = grid[y1 * GRID_W + x1]!;
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/* --- how wide the brain is at each point of the profile ------------------- */

/* A real brain is 140mm across against 167mm long, so the half width at its
   widest is a little over four fifths of the half length. It is widest at the
   temporal and parietal region, a little behind the middle, and narrows towards
   both poles and towards the crown, where the hemispheres curve in to meet the
   longitudinal fissure. */
const MAX_HALF_WIDTH = 0.8;

function halfWidth(px: number, py: number) {
  const alongT = clamp((px + 1.05) / 2.1, 0, 1);
  const along = 0.6 + 0.4 * Math.sin(Math.PI * Math.pow(alongT, 0.88));

  const upT = clamp((py + PROFILE_HALF_HEIGHT) / (2 * PROFILE_HALF_HEIGHT), 0, 1);
  const crown = Math.pow(Math.max(0, upT - 0.56) / 0.44, 1.5);
  const floor = Math.pow(Math.max(0, 0.3 - upT) / 0.3, 1.4);
  const up = 1 - crown * 0.34 - floor * 0.2;

  return MAX_HALF_WIDTH * along * Math.max(0.2, up);
}

/* --- value noise, for the folds ------------------------------------------ */

function hash(ix: number, iy: number, iz: number) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);

  const c00 = hash(ix, iy, iz) + (hash(ix + 1, iy, iz) - hash(ix, iy, iz)) * fx;
  const c10 = hash(ix, iy + 1, iz) + (hash(ix + 1, iy + 1, iz) - hash(ix, iy + 1, iz)) * fx;
  const c01 = hash(ix, iy, iz + 1) + (hash(ix + 1, iy, iz + 1) - hash(ix, iy, iz + 1)) * fx;
  const c11 =
    hash(ix, iy + 1, iz + 1) + (hash(ix + 1, iy + 1, iz + 1) - hash(ix, iy + 1, iz + 1)) * fx;

  const c0 = c00 + (c10 - c00) * fy;
  const c1 = c01 + (c11 - c01) * fy;
  return c0 + (c1 - c0) * fz;
}

/* --- the solid ------------------------------------------------------------ */

export const CORTEX = 0;
export const CEREBELLUM = 1;

/* The box the sampler draws candidates from. Tight: every unit of empty space
   in it is samples thrown away. */
export const BOUNDS = {
  min: [-1.06, -0.76, -0.84] as const,
  max: [1.06, 0.76, 0.84] as const,
};

/* How much the lateral surface rounds into the profile's edge. Without it the
   brain is an extrusion with flat sides and a hard rim. */
const ROUND = 0.2;

/* The smooth solid, with no folds in it.

   Kept separate from the folded surface on purpose. This is the first stage of
   a two stage rejection: it costs a few dozen floating point operations and
   kills nine candidates in ten, and only the survivors pay for the fold field,
   which is where the noise is. Collapsing the two would put the expensive half
   on every candidate. */
export function baseDistance(px: number, py: number, pz: number): number {
  const prism = profileDistance(px, py) + ROUND;
  const slab = Math.abs(pz) - halfWidth(px, py) + ROUND;

  const dx = Math.max(prism, 0);
  const dz = Math.max(slab, 0);
  let brain = Math.min(Math.max(prism, slab), 0) + Math.hypot(dx, dz) - ROUND;

  /* The longitudinal fissure: a groove down the midline from above, deep at the
     crown and closing before the base, because the hemispheres are joined
     underneath.

     Widened from 0.045 and taken further down the brain. At the old width it
     was a crease one particle across in a cloud of ten thousand, which is to
     say it was a rounding error: the mass read as one lump rather than as two
     hemispheres, and from a three quarter view that is the single most
     brain-identifying feature there is.

     Chosen against a sweep rather than by eye. The notch it cuts in the crown,
     measured as how far the midline's top falls below the top of the band
     beside it, is 0.078 at the old 0.062, 0.141 here, and 0.660 at 0.090, where
     the fissure has stopped parting the hemispheres and started severing them:
     the crown is empty above the join and the shape reads as two lumps rather
     than as one brain. */
  const fissure = Math.max(Math.abs(pz) - 0.075, -(py - 0.02));
  const k = 0.055;
  const h = clamp(0.5 - (0.5 * (brain + fissure)) / k, 0, 1);
  brain = brain + (-fissure - brain) * h + k * h * (1 - h);

  return brain;
}

/* Which mass a point is in. The cerebellum sits low and behind, and its
   foliation is several times finer than a cortical gyrus, which is the contrast
   that stops it reading as a second lump of cortex. */
export function regionAt(px: number, py: number): number {
  const ex = (px - 0.62) / 0.42;
  const ey = (py + 0.42) / 0.3;
  return ex * ex + ey * ey < 1 ? CEREBELLUM : CORTEX;
}

/* --- the named sulci ------------------------------------------------------ */

/* Two landmarks, traced in the same profile coordinates as the outline.

   Uniform folding everywhere makes a walnut. What makes a folded mass read as a
   brain, in a lateral view, is that its folds are interrupted by two clefts
   that are deeper and longer than any gyrus and that always run the same way,
   and those two clefts are what divide the lobes: everything above and in front
   of the central sulcus is frontal, behind it parietal, below the lateral
   fissure temporal.

   Placed against the traced outline rather than by eye on a rendered frame, so
   they sit on real material: the lateral fissure runs back and slightly up from
   above the temporal pole, and the central sulcus runs down and forward from
   just behind the vertex, stopping short of meeting it.

   Functions of x and y alone, for the same reason the fold bands are. The
   particles are drawn with no depth test, so the far surface shines through the
   near one, and a landmark that varied across the width would have the far
   hemisphere's cortex filling the near hemisphere's cleft. Both hemispheres
   carry the same two sulci in a real brain anyway. */
const LATERAL_SULCUS = [
  [-0.62, -0.24],
  [-0.3, -0.27],
  [0.05, -0.17],
  [0.34, -0.02],
] as const;

const CENTRAL_SULCUS = [
  [0.14, 0.62],
  [0.02, 0.4],
  [-0.11, 0.18],
  [-0.2, -0.02],
] as const;

/* How wide the floor of a named sulcus is, and how far its walls run out to
   ordinary cortex. A real central sulcus is a couple of millimetres across at
   the surface against a brain of 167mm, so this is several times wider than
   life: at true scale it is invisible in a cloud of thirty thousand specks. */
const SULCUS_HALF_WIDTH = 0.035;
const SULCUS_FALLOFF = 0.105;

/* How far below an ordinary sulcal floor a named one sinks, as a share of the
   fold depth. Not one: at one the cleft is a clean slot with vertical walls,
   which reads as a saw cut rather than as a fold, and the walls are where a
   reader actually sees the depth. */
export const LANDMARK_SINK = 0.85;

function polylineDistance(px: number, py: number, points: readonly (readonly [number, number])[]) {
  let nearest = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const ex = bx - ax;
    const ey = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1), 0, 1);
    const dx = wx - ex * t;
    const dy = wy - ey * t;
    nearest = Math.min(nearest, dx * dx + dy * dy);
  }
  return Math.sqrt(nearest);
}

/* One on the floor of a named sulcus, nought out in ordinary cortex. */
export function landmarkPhase(px: number, py: number): number {
  const distance = Math.min(
    polylineDistance(px, py, LATERAL_SULCUS),
    polylineDistance(px, py, CENTRAL_SULCUS),
  );
  const t = clamp((distance - SULCUS_HALF_WIDTH) / SULCUS_FALLOFF, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

/* --- the folds ------------------------------------------------------------ */

/* Nought in the floor of a sulcus, one on the crown of a gyrus.

   The band coordinate is depth into the profile, which is a function of x and y
   only. That matters more than it sounds. The particles are drawn with additive
   blending and no depth test, so the far surface shines through the near one,
   and any fold pattern that varies across the width gives the two surfaces
   different grooves at the same screen position: each fills in the other and
   the cortex reads as an even fuzz however deeply the sulci are emptied. Bands
   that depend only on the profile are identical on both sides, so they
   reinforce instead of cancelling.

   Warped hard, and by two scales, so they meander and branch the way gyri do
   rather than reading as a contour map. */
/* How many gyri run across the brain, and how far they wander. Tuned by
   looking: too few and it is a pumpkin, too many and the bands close up into an
   even fuzz once the far surface shines through the near one. */
const FOLD_FREQUENCY = 2.4;
const FOLD_BANDS = 11;
const FOLD_STRETCH = 0.36;

/* How far a gyral crown stands out from the floor of its sulcus, in model
   units, against a half length of one. A real cortex folds by something like a
   twentieth of the brain's length, and this is that.

   It is the number that was missing entirely. Until now the folds existed only
   as a rule about which particles to throw away, painted over a surface that
   was perfectly smooth: a stencil, with no relief, catching no light
   differently and moving the surface nowhere. A stencil reads as texture. Folds
   have to displace. */
export const FOLD_DEPTH = 0.052;

export function foldPhase(px: number, py: number, pz: number, region: number): number {
  if (region === CEREBELLUM) {
    const warp = valueNoise(px * 9 + 21.1, py * 9 + 3.4, pz * 3 + 12.9) - 0.5;
    const band = py * 38 + warp * 1.2;
    return 1 - Math.abs((band - Math.floor(band)) * 2 - 1);
  }

  /* Bands between the level sets of a wandering field, in the profile plane.

     Three constructions were tried before this one and each failed in its own
     way, which is worth recording because they all look plausible written down.
     Isotropic three dimensional noise gives the near and far surfaces different
     grooves at the same screen position, so with additive blending and no depth
     test each fills in the other and the cortex reads as an even fuzz. Depth
     into the profile is coherent through the brain, but it is monotonic
     inwards, so its bands are nested: a contour map, not a cortex. Ridged noise
     wanders and branches, but its ridges are broad irregular patches rather
     than lines, because value noise varies too slowly for the ridge to be thin.

     What gyri actually look like is the gap between successive level sets of a
     field that wanders. Take a smooth field of x and y, multiply, and keep the
     fractional part: the bands follow the field's contours, which meander,
     close on themselves and branch at every saddle. Depending on x and y alone
     keeps them identical on both hemispheres, so they reinforce through the
     depth of the brain instead of cancelling. */
  /* Compressed along the length, so the field's features stretch that way and
     its level sets run front to back. Isotropic, the bands come out as rings
     around each hill and hollow in the field, which reads as craters. Gyri are
     worms, and on the lateral surface they run broadly front to back. */
  const fx = px * FOLD_FREQUENCY * FOLD_STRETCH;
  const fy = py * FOLD_FREQUENCY;
  const field =
    valueNoise(fx + 3.1, fy + 7.7, 0.5) +
    valueNoise(fx * 2.3 + 9.4, fy * 2.3 + 2.2, 2.5) * 0.42 +
    valueNoise(fx * 4.7 + 1.8, fy * 4.7 + 5.3, 4.5) * 0.16;

  const band = field * FOLD_BANDS;
  void pz;
  return 1 - Math.abs((band - Math.floor(band)) * 2 - 1);
}

/* The two together: where the folded surface is, relative to the smooth solid,
   as a share of the fold depth.

   Signed, and that is the point of it. One is the crown of a gyrus and nought
   is the floor of an ordinary sulcus, so a negative value is below the smooth
   solid's own surface, which is the only way to say "cut in" in a scheme where
   the folds are otherwise all relief. The named clefts interrupt the banding
   rather than joining it, which is what a landmark sulcus does to the gyri it
   crosses.

   It says nothing about density, and that separation cost a measurement to
   find. Emptying the clefts of particles took the silhouette overlap from 93.6%
   to 86.1%, and the guard was right: a fissure is not a hole. It is a slit the
   cortex folds down into, its two banks pressed together, and in projection
   there is no gap at all, only a groove. The cortex continues down the walls,
   so the density follows the gyral banding and the displacement follows this. */
export function foldOffset(px: number, py: number, gyral: number, region: number): number {
  if (region === CEREBELLUM) return gyral;
  const cleft = landmarkPhase(px, py);
  return gyral * (1 - cleft) - cleft * LANDMARK_SINK;
}
