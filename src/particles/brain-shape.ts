import { clamp, mulberry32 } from "./pack";
import type { Shape } from "./shapes";

/* The brain, as a volume rather than a shell.

   The surface maths here is carried over from the version of this site that
   drew the cloud as a flat constellation, where it was tuned by looking at it
   rather than derived: a Fibonacci sphere pushed into a brain with a flat
   underside, a temporal lobe cut away by a lateral sulcus, a tapered occipital
   pole, a narrowed frontal pole, folds displacing the surface along its normal,
   and a fissure down the midline. That tuning is the expensive part and it is
   the part worth keeping.

   What is new is that it fills. The old version put every particle on the
   surface, which is exactly the hollow shell the specification warns against:
   from outside, a shell and a volume look identical until the cloud turns or
   comes apart, and then the shell reads as a paper model. Here a particle takes
   a direction and then a radius along it, biased hard towards the outside, so
   the cortex is dense, the interior is populated but thinner, and the
   silhouette is unchanged.

   No mesh, no model file, no licence question. The shape is an expression. */

/* Deterministic value noise, matched to the shader's so that the asset and the
   runtime agree about where a fold sits. */
function noise(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/* Where the cortical surface sits in one direction.

   Returns the point rather than a radius, because several of the deformations
   are not radial: the temporal lobe moves a point down as well as out, and the
   lateral sulcus pushes it back up again. */
function surfacePoint(index: number, count: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const unit = 1 - (index / Math.max(1, count - 1)) * 2;
  const band = Math.sqrt(Math.max(0, 1 - unit * unit));
  const angle = golden * index;

  /* Negative x is the frontal pole. The brain faces left, which is the way it
     sits in the reference and the way it reads next to a headline. */
  let px = -Math.cos(angle) * band * 1.34;
  let py = unit * 0.84;
  let pz = Math.sin(angle) * band * 0.72;

  /* Flat underneath. A brain sits on its base; an ellipsoid does not. */
  if (py < 0) py *= 0.52 + 0.48 * Math.min(1, Math.abs(px));

  /* The temporal lobe, and the lateral sulcus that separates it from the rest.
     Without the sulcus the underside is one smooth mass and the silhouette
     loses the single feature that most says brain. */
  const temporal = Math.exp(-((px + 0.28) ** 2 * 2.4 + (py + 0.42) ** 2 * 5.2));
  py -= temporal * 0.24;
  pz *= 1 + temporal * 0.12;
  const sulcus = Math.exp(-((py + 0.2) ** 2 * 60 + (px + 0.1) ** 2 * 0.9));
  py += sulcus * 0.05;

  /* Tapered at the back, narrowed at the front. */
  const back = Math.max(0, (px - 0.55) / 0.8);
  py *= 1 - back * 0.17;
  pz *= 1 - back * 0.15;
  const front = Math.max(0, (-px - 0.72) / 0.7);
  pz *= 1 - front * 0.13;

  /* Gyri. The phase is kept afterwards by the caller, because it decides
     whether this point is on a crest or down in a sulcus, and that drives how
     densely the region is filled. */
  const phase =
    Math.sin(px * 5.4 + pz * 2.2) * 0.55 +
    Math.sin(py * 6.4 + px * 2.7) * 0.3 +
    Math.sin(pz * 7.6 + py * 3.3) * 0.15;
  const length = Math.hypot(px, py, pz) || 1;
  const displacement = phase * 0.09;
  px += (px / length) * displacement;
  py += (py / length) * displacement;
  pz += (pz / length) * displacement;

  /* The longitudinal fissure: a groove down the midline separating the two
     hemispheres. */
  py -= Math.exp(-(pz * pz) * 45) * Math.max(0, py) * 0.17;

  return [px, py, pz];
}

function foldPhase(px: number, py: number, pz: number) {
  return (
    Math.sin(px * 5.4 + pz * 2.2) * 0.55 +
    Math.sin(py * 6.4 + px * 2.7) * 0.3 +
    Math.sin(pz * 7.6 + py * 3.3) * 0.15
  );
}

/* Raw model space, before normalisation into the texture's nought to one. */
function rawBrain(count: number, random: () => number): Float32Array {
  const out = new Float32Array(count * 3);

  /* Most of the cloud is cortex. The cerebellum is its own tighter cluster
     behind and below, with a finer texture, and a short stem below that: both
     are small, and both are the difference between a brain and a walnut. */
  const cerebellumShare = 0.1;
  const stemShare = 0.025;
  const cortex = Math.round(count * (1 - cerebellumShare - stemShare));
  const cerebellum = Math.round(count * cerebellumShare);

  for (let i = 0; i < count; i++) {
    if (i < cortex) {
      /* Spread the directions over a larger Fibonacci set than there are
         particles, so that two particles rarely take the same direction and the
         surface does not band. */
      const direction = Math.floor(random() * cortex * 4);
      const [sx, sy, sz] = surfacePoint(direction, cortex * 4);

      /* Inward along the ray, biased hard towards the surface. A uniform radius
         would put most particles in the middle, where none of them can be seen,
         and leave the silhouette thin. */
      const depth = 1 - 0.42 * Math.pow(random(), 2.1);

      /* Valleys between the folds are thinned rather than merely dimmed, which
         is what separates a folded surface from a smooth one. */
      const crest = (foldPhase(sx, sy, sz) + 1) / 2;
      const keep = 0.52 + crest * 0.48;
      const jitter = random() < keep ? 1 : 0.94;

      out[i * 3] = sx * depth * jitter + (random() - 0.5) * 0.02;
      out[i * 3 + 1] = sy * depth * jitter + (random() - 0.5) * 0.02;
      out[i * 3 + 2] = sz * depth * jitter + (random() - 0.5) * 0.02;
      continue;
    }

    if (i < cortex + cerebellum) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = Math.cbrt(random()) * (1 - 0.3 * Math.pow(random(), 2));
      const px = Math.sin(phi) * Math.cos(theta) * r * 0.34;
      const py = Math.cos(phi) * r * 0.21;
      const pz = Math.sin(phi) * Math.sin(theta) * r * 0.3;
      /* The fine parallel foliation that makes a cerebellum look like one. */
      const ripple = Math.sin(px * 38) * Math.sin(py * 34) * 0.02;
      out[i * 3] = px + 0.93 + ripple;
      out[i * 3 + 1] = py - 0.5 + ripple;
      out[i * 3 + 2] = pz;
      continue;
    }

    /* The stem, a short tapering column below the join. */
    const t = random();
    const spread = 0.12 * (1 - t * 0.45);
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * spread;
    out[i * 3] = 0.62 + Math.cos(theta) * r + noise(i, 3) * 0.02;
    out[i * 3 + 1] = -0.62 - t * 0.42;
    out[i * 3 + 2] = Math.sin(theta) * r;
  }

  return out;
}

/* The same extent every other shape is normalised to, so a morph changes the
   shape and not the apparent size of the cloud. */
const EXTENT = 0.34;

function normalise(raw: Float32Array, count: number): Shape {
  let radius = 0;
  for (let i = 0; i < count; i++) {
    radius = Math.max(radius, Math.hypot(raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!));
  }
  const scale = radius > 0 ? EXTENT / radius : 1;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) out[i] = clamp(0.5 + raw[i]! * scale, 0, 1);
  return out;
}

export function brain(count: number, seed: number): Shape {
  return normalise(rawBrain(count, mulberry32(seed)), count);
}

/* Rescales a shape about the centre of the texture so that its furthest
   particle sits exactly at the same extent every other shape uses.

   This is not tidiness. Positions are stored in a texture whose values run
   nought to one, so a shape that reaches past that is not merely large, it is
   clamped: every particle that would have gone further piles up against the
   boundary and the shape grows a flat wall along its long axis. The data field
   had one, and it is invisible in the maths and obvious the moment you look. */
function fitToExtent(shape: Shape, count: number): Shape {
  let radius = 0;
  for (let i = 0; i < count; i++) {
    radius = Math.max(
      radius,
      Math.hypot(shape[i * 3]! - 0.5, shape[i * 3 + 1]! - 0.5, shape[i * 3 + 2]! - 0.5),
    );
  }
  if (radius <= EXTENT) return shape;

  const scale = EXTENT / radius;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) out[i] = 0.5 + (shape[i]! - 0.5) * scale;
  return out;
}

/* The other three targets are derived from the brain per particle rather than
   generated independently, which is what keeps a morph coherent: particle four
   thousand is the same speck of matter in every shape it passes through, so the
   transition reads as the cloud rearranging rather than as one picture being
   cross faded into another. */

/* Target two: the brain drawn out into a data field. Stretched along its long
   axis, flattened, and combed into horizontal strata. */
export function dataField(source: Shape, count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = (source[i * 3]! - 0.5) / EXTENT;
    const y = (source[i * 3 + 1]! - 0.5) / EXTENT;
    const z = (source[i * 3 + 2]! - 0.5) / EXTENT;

    /* Strata: the vertical position is quantised towards bands, so the field
       reads as ordered data rather than as a cloud that has been stretched. */
    const bands = 9;
    const banded = Math.round(y * bands) / bands;
    out[i * 3] = 0.5 + x * EXTENT * 2.1;
    out[i * 3 + 1] = 0.5 + (banded * 0.72 + (random() - 0.5) * 0.05) * EXTENT;
    out[i * 3 + 2] = 0.5 + z * EXTENT * 1.35;
  }
  return fitToExtent(out, count);
}

/* Target three: a double helix, which is the structured non blob the
   specification asks for. The particle's position along the brain's long axis
   becomes its position along the helix, and its offset within the brain becomes
   its offset within the strand, so the shape unwinds out of the brain rather
   than appearing in its place. */
export function helix(source: Shape, count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = (source[i * 3]! - 0.5) / EXTENT;
    const y = (source[i * 3 + 1]! - 0.5) / EXTENT;
    const z = (source[i * 3 + 2]! - 0.5) / EXTENT;

    const along = clamp(x / 1.4, -1, 1);
    const strand = z >= 0 ? 0 : Math.PI;
    const turns = 2.6;
    const angle = along * Math.PI * turns + strand;
    const radius = 0.52 + y * 0.12 + (random() - 0.5) * 0.06;

    out[i * 3] = 0.5 + along * 1.15 * EXTENT;
    out[i * 3 + 1] = 0.5 + Math.sin(angle) * radius * EXTENT * 1.6;
    out[i * 3 + 2] = 0.5 + Math.cos(angle) * radius * EXTENT * 1.6;
  }
  return fitToExtent(out, count);
}

/* Target four: back towards the brain, but not yet arrived. Every particle sits
   between its brain position and a loosened version of it, so the last
   transition of the timeline reads as the cloud gathering itself. */
export function reassembly(source: Shape, count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const looseness = 0.16 + random() * 0.2;
    for (let axis = 0; axis < 3; axis++) {
      const value = source[i * 3 + axis]!;
      const outward = 0.5 + (value - 0.5) * (1 + looseness);
      out[i * 3 + axis] = outward + (random() - 0.5) * 0.02;
    }
  }
  return fitToExtent(out, count);
}

export function brainTargets(count: number, seed: number): Shape[] {
  const first = brain(count, seed);
  return [
    first,
    dataField(first, count, seed + 11),
    helix(first, count, seed + 23),
    reassembly(first, count, seed + 37),
  ];
}
