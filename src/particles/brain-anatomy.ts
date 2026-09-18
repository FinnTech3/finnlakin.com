import { clamp } from "./pack";

/* The brain's shape, as a signed distance field.

   This replaces a Fibonacci sphere pushed about by three sine waves. That
   approach was the reason the cloud never looked like a brain however much it
   was tuned: a sphere plus low frequency trigonometry is a lumpy potato, and
   the features that actually say "brain" to a reader are not deformations of a
   sphere at all. They are separate masses joined together, and grooves cut back
   out of them.

   The reference this is measured against solves it by shipping a sculpted model
   baked into a floating point texture of positions. That is the right answer if
   you have an artist. Without one, the next best thing is to build the masses
   and the grooves explicitly, in the order an anatomist would name them, and
   let a distance field do the joining:

     cerebrum        one ellipsoid, tapered at the occipital pole, narrowed at
                     the frontal pole, flattened underneath
     temporal lobe   a second, smaller, pointing forward and sitting low
     lateral sulcus  a groove subtracted between them, at the angle it really
                     runs, which is the single most recognisable feature of a
                     brain seen from the side
     longitudinal    a thin slab subtracted down the midline from above,
     fissure         separating the hemispheres
     cerebellum      its own mass behind and below, joined but distinct
     brain stem      a short tapered column leaving from between them

   Everything is in model units where the cerebrum's half length is one. The
   proportions are the measured ones: a human cerebrum is about 167mm long,
   140mm wide and 93mm tall, so half width is 0.84 and half height 0.56 against
   a half length of 1. The previous version had it far too narrow and too tall,
   which is why it read as an egg. */

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

/* --- distance field primitives ------------------------------------------- */

function sdEllipsoid(px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  const k0 = Math.hypot(px / rx, py / ry, pz / rz);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return (k0 * (k0 - 1)) / k1;
}

/* A capsule, for the stem: the distance to a segment, minus a radius that
   tapers along it. */
function sdTaperedCapsule(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  ra: number,
  rb: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const wx = px - ax;
  const wy = py - ay;
  const wz = pz - az;
  const denominator = dx * dx + dy * dy + dz * dz;
  const t = denominator > 0 ? clamp((wx * dx + wy * dy + wz * dz) / denominator, 0, 1) : 0;
  return Math.hypot(wx - dx * t, wy - dy * t, wz - dz * t) - (ra + (rb - ra) * t);
}

function smoothUnion(a: number, b: number, k: number) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

function smoothSubtract(a: number, b: number, k: number) {
  const h = clamp(0.5 - (0.5 * (b + a)) / k, 0, 1);
  return b + (-a - b) * h + k * h * (1 - h);
}

/* --- the brain, without its folds ---------------------------------------- */

/* Which mass a point belongs to. The folds differ between them by a lot: a
   cerebellum's foliation is several times finer than a cortical gyrus, and that
   contrast is one of the strongest signals that something is a brain rather
   than a walnut. */
export const CORTEX = 0;
export const CEREBELLUM = 1;
export const STEM = 2;

/* The bounding box the sampler draws from. Tight, because every unit of empty
   space in it is samples thrown away. */
export const BOUNDS = {
  min: [-1.16, -0.78, -0.92] as const,
  max: [1.2, 0.72, 0.92] as const,
};

/* Negative inside, positive outside, in model units. No noise: this is the
   cheap test the sampler runs on every candidate, and the folds are only
   evaluated for the few that survive it. */
export function baseDistance(px: number, py: number, pz: number): number {
  /* The cerebrum. Warped before the ellipsoid rather than after it, so the
     pole shapes are part of the surface rather than a displacement of it.

     Front narrowing: the frontal pole is appreciably narrower than the widest
     point, which sits about a fifth of the way behind the middle.
     Back tapering: the occipital pole comes to a blunt point and rides high. */
  const front = Math.max(0, -px - 0.30) / 0.78;
  const back = Math.max(0, px - 0.32) / 0.78;
  const narrow = 1 - front * front * 0.36 - back * back * 0.30;
  /* The crown is at the parietal lobe, a little behind the middle, and both
     poles sit below it. Lifting the back, which is what this did first, gives a
     wedge rising towards the occiput, and a brain does the opposite. */
  const drop = front * front * 0.13 + back * back * 0.08;

  let cerebrum = sdEllipsoid(
    px - 0.04,
    py - 0.02 + drop,
    pz / Math.max(0.2, narrow),
    1.0,
    0.66,
    0.74,
  );
  /* Scaling z inside the ellipsoid makes the field a slight over-estimate of
     distance there, which is harmless for an inside test and for a shell that
     is a fraction of a millimetre thick in these units. */
  cerebrum *= Math.max(0.2, narrow);

  /* Flat underneath. A brain rests on its base; an ellipsoid does not. The
     plane is not level: the base tilts up towards the front. */
  const base = -(py + 0.34 - px * 0.06);
  cerebrum = Math.max(cerebrum, base);

  /* The temporal lobe: forward pointing, low, and lateral. It is a separate
     mass, which is why it can have a groove above it. */
  const temporal = sdEllipsoid(px + 0.2, py + 0.3, Math.abs(pz) - 0.42, 0.62, 0.24, 0.26);
  let brain = smoothUnion(cerebrum, temporal, 0.12);

  /* The lateral sulcus, which everybody recognises and almost nobody draws. It
     runs up and back from just behind the temporal pole at about twenty
     degrees, and it is deep: it very nearly separates the temporal lobe from
     the rest of the hemisphere.

     Cut as a capsule swept along that line on each lateral surface, rather than
     as a flattened ellipsoid. The ellipsoid version came out as a scar across
     the middle of the side, because a thin ellipsoid subtracted from a curved
     surface removes a band of constant height rather than a furrow that follows
     the curve. A capsule at a fixed distance from the midline follows it. */
  const sulcus = sdTaperedCapsule(
    px,
    py,
    Math.abs(pz),
    -0.62,
    -0.20,
    0.50,
    0.42,
    0.10,
    0.44,
    0.055,
    0.075,
  );
  brain = smoothSubtract(sulcus, brain, 0.05);

  /* The longitudinal fissure, down the midline from above. Deep at the top,
     closing before the base, because the hemispheres are joined underneath. */
  const fissureDepth = 0.34;
  const fissure = Math.max(
    Math.abs(pz) - 0.035,
    -(py - (0.56 - fissureDepth) + 0.1),
  );
  brain = smoothSubtract(fissure, brain, 0.03);

  /* The cerebellum. Behind, below, and its own mass: wider than it is tall,
     and tucked under the occipital pole rather than hanging off it. */
  const cerebellum = sdEllipsoid(px - 0.82, py + 0.4, pz, 0.34, 0.24, 0.44);
  brain = smoothUnion(brain, cerebellum, 0.07);

  /* And the stem, leaving forward and down from between them. Short: it
     continues out of frame rather than ending in mid air. */
  const stem = sdTaperedCapsule(px, py, pz, 0.5, -0.28, 0, 0.62, -0.72, 0, 0.14, 0.09);
  return smoothUnion(brain, stem, 0.07);
}

export function regionAt(px: number, py: number, pz: number): number {
  const cerebellum = sdEllipsoid(px - 0.82, py + 0.4, pz, 0.36, 0.26, 0.46);
  const stem = sdTaperedCapsule(px, py, pz, 0.5, -0.28, 0, 0.62, -0.72, 0, 0.15, 0.1);
  if (stem < 0 && stem < cerebellum) return STEM;
  if (cerebellum < 0) return CEREBELLUM;
  return CORTEX;
}

/* --- the folds ------------------------------------------------------------ */

/* Nought in the floor of a sulcus, one on the crown of a gyrus.

   Two rebuilds were spent on isotropic three dimensional noise here, and it
   cannot work, for a reason that has nothing to do with the noise. The
   particles are drawn with additive blending and no depth test, so the far
   surface shines through the near one. Isotropic noise gives the two surfaces
   different fold patterns at the same screen position, so every groove on the
   side facing you is filled in by whatever happens to be behind it, and the
   cortex reads as an even fuzz no matter how deeply the sulci are emptied.

   The folds have to be coherent through the depth of the brain, not just across
   its surface. So they are bands at a constant distance from the lateral
   sulcus: concentric arcs radiating out from it, which is both what survives the
   overlap and, not coincidentally, roughly how the real gyral pattern runs on
   the lateral surface. The sulcus is mirrored across the midline, so the near
   and far hemispheres carry matching arcs and the bands reinforce instead of
   cancelling.

   The cerebellum keeps its own pattern: transverse folia, several times finer,
   which is the contrast that stops it reading as a second lump of cortex. */
export function foldPhase(px: number, py: number, pz: number, region: number): number {
  if (region === CEREBELLUM) {
    /* Folia run across the cerebellum, so the band coordinate is height, and
       they are fine: about twenty across a mass a third the size of the
       cerebrum. */
    const warp = valueNoise(px * 9 + 21.1, py * 9 + 3.4, pz * 3 + 12.9) - 0.5;
    const band = py * 34 + warp * 1.1;
    return 1 - Math.abs((band - Math.floor(band)) * 2 - 1);
  }

  /* Distance from the line the lateral sulcus runs along, which is the same
     capsule the field subtracts, without its radius. */
  const along = sdTaperedCapsule(px, py, Math.abs(pz), -0.62, -0.2, 0.5, 0.42, 0.1, 0.44, 0, 0);

  /* Warped, so the arcs are irregular and branch rather than reading as a
     contour map. Two scales: a slow one that bends whole bands, and a quicker
     one that breaks their edges up. */
  const slow = valueNoise(px * 1.6 + 11.3, py * 1.6 + 4.1, pz * 1.1 + 7.7) - 0.5;
  const quick = valueNoise(px * 5.2 + 2.7, py * 5.2 + 8.8, pz * 3.4 + 1.5) - 0.5;
  const band = along * 7.4 + slow * 1.5 + quick * 0.42;

  return 1 - Math.abs((band - Math.floor(band)) * 2 - 1);
}
