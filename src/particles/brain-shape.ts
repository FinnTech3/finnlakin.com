import {
  BOUNDS,
  CEREBELLUM,
  FOLD_DEPTH,
  baseDistance,
  foldOffset,
  foldPhase,
  regionAt,
} from "./brain-anatomy";
import { clamp, mulberry32 } from "./pack";
import type { Shape } from "./shapes";

/* The brain, sampled out of the distance field in brain-anatomy.ts.

   What used to be here was a Fibonacci sphere displaced by three sine waves,
   tuned by eye over two rebuilds, and it never looked like a brain. The reason
   turned out to be structural rather than a matter of tuning: the features that
   say "brain" are separate masses joined together and grooves cut back out of
   them, and none of those is a deformation of a sphere. The reference this is
   measured against sidesteps the problem by baking a sculpted model into a
   texture of positions, which is the right answer if you have an artist to make
   one. This is the next best thing, and it is built the way an anatomist would
   name the parts.

   The sampling is rejection in a tight box, in two stages, which is what keeps
   it quick enough to run at page load:

     1. A candidate is tested against the analytic field, which has no noise in
        it and costs a few dozen floating point operations. Ninety percent of
        candidates die here.
     2. Only survivors are tested against the fold field, which is the
        expensive part, and only survivors of that are written.

   A particle in the floor of a sulcus is thrown away rather than moved, which
   is the difference between a cortex and a fuzzy potato: a fold is visible
   because of what is not there. */

/* How deep the populated skin goes, in model units. */
const SKIN = 0.05;

/* The share of the body's particles scattered through the interior instead of
   on the skin, so the cloud is hollow rather than empty and does not read as a
   balloon when it turns.

   A share of the output, counted, rather than a probability applied to each
   interior candidate. As a probability it was unpredictable, because the number
   of candidates is set by the volume they are drawn from: the interior of this
   brain is about five times the volume of its skin, so a per candidate rate of
   one in twenty put one particle in five inside. Counting is exact and it stays
   exact when the shape changes. */
const INTERIOR_SHARE = 0.05;

/* And a sparse few drifting outside the body altogether, which the reference
   has and which stops the silhouette reading as a cut-out. */
const STRAY_SHARE = 0.009;

/* How strongly the sulci are thinned.

   A ramp, not a hard cut. A hard cut empties the grooves completely, and the
   reference has particles in its grooves: what makes a fold read there is the
   contrast between a dense bright crown and a sparse dim floor, not an absence.
   A ramp also keeps the silhouette intact, where a cut chewed lumps out of it
   wherever a sulcus ran off the edge. */
const SULCUS_THINNING = 2.2;
const CEREBELLUM_THINNING = 1.4;

/* A ceiling on the sampling loop, so a change to the field that makes it
   unsamplable fails fast rather than hanging the page. */
const MAX_TRIES_PER_PARTICLE = 900;

function rawBrain(
  count: number,
  random: () => number,
  tone: Float32Array,
  relief: Float32Array,
): Float32Array {
  const out = new Float32Array(count * 3);
  const minX = BOUNDS.min[0];
  const minY = BOUNDS.min[1];
  const minZ = BOUNDS.min[2];
  const spanX = BOUNDS.max[0] - minX;
  const spanY = BOUNDS.max[1] - minY;
  const spanZ = BOUNDS.max[2] - minZ;

  const strays = Math.round(count * STRAY_SHARE);
  const body = count - strays;

  const interiorBudget = Math.round(body * INTERIOR_SHARE);
  let interiorWritten = 0;
  let written = 0;
  let tries = 0;
  const ceiling = body * MAX_TRIES_PER_PARTICLE;

  while (written < body && tries < ceiling) {
    tries += 1;
    const px = minX + random() * spanX;
    const py = minY + random() * spanY;
    const pz = minZ + random() * spanZ;

    const distance = baseDistance(px, py, pz);
    /* Widened by the fold depth: a crown bulges past the smooth surface, so a
       candidate that stage one would call "outside" may be inside the folded
       one. Without this the crowns are shaved flat and the corrugation only
       ever cuts inward. */
    if (distance >= FOLD_DEPTH) continue;

    const region = regionAt(px, py);

    if (distance < -SKIN - FOLD_DEPTH) {
      /* Interior. Kept to a budget, dimmed, and not subject to the fold test:
         what is inside is not a cortex. */
      if (interiorWritten >= interiorBudget) continue;
      interiorWritten += 1;
      out[written * 3] = px;
      out[written * 3 + 1] = py;
      out[written * 3 + 2] = pz;
      tone[written] = 0.1 + random() * 0.18;
      relief[written] = 0;
      written += 1;
      continue;
    }

    const phase = foldPhase(px, py, pz, region);

    /* The folded surface. The smooth solid is pushed outward wherever the fold
       field is high, so a crown stands proud by the fold depth and the floor of
       a sulcus stays where the smooth surface was. This is the change that
       makes the cortex structure rather than pattern: the particles now sit on
       a corrugated surface instead of on a ball with a stencil over it.

       The offset is signed where a named cleft crosses, so the same arithmetic
       pushes the surface inward instead of outward and cuts the lateral fissure
       and the central sulcus into the mass rather than drawing them on it. */
    const folded = distance - FOLD_DEPTH * foldOffset(px, py, phase, region);
    if (folded > 0 || folded < -SKIN) continue;

    /* Density follows the gyral banding and not the clefts. The cortex folds
       down into a fissure rather than stopping at it, so the walls carry their
       particles and the projection has a groove rather than a hole: taking them
       out instead dropped the silhouette overlap from 93.6% to 86.1%, which is
       the guard noticing that the shape had stopped filling its own outline. */
    const thinning = region === CEREBELLUM ? CEREBELLUM_THINNING : SULCUS_THINNING;
    if (random() > Math.pow(phase, thinning)) continue;

    out[written * 3] = px;
    out[written * 3 + 1] = py;
    out[written * 3 + 2] = pz;

    /* Colour cannot come from the fold phase, which was the first thing tried
       and is wrong for an instructive reason: once the valleys are rejected,
       almost every surviving particle is on a crown, so the phase is near one
       everywhere and the whole cloud collapses to one end of the ramp.

       What still varies is which part of the surface you are looking at, so the
       colour follows a slow field over it. Broad regions differ, neighbours do
       not, and the folds are read from the gaps rather than from the colour.
       The cerebellum sits low on the ramp regardless, because it is in shadow
       under the occipital pole and reads as a darker mass in every photograph
       of a brain there has ever been. */
    const field =
      Math.sin(px * 2.1 + 0.4) * 0.5 + Math.sin(py * 2.6 - 0.7) * 0.3 + Math.sin(pz * 1.7) * 0.2;
    const base = clamp(0.52 + field * 0.46, 0, 1);
    tone[written] = region === CEREBELLUM ? base * 0.42 : base;
    relief[written] = phase;
    written += 1;
  }

  /* If the field ever becomes unsamplable, fail loudly in the validator rather
     than quietly shipping a half empty brain. */
  if (written < body) {
    for (let i = written; i < body; i++) {
      out[i * 3] = 0;
      out[i * 3 + 1] = 0;
      out[i * 3 + 2] = 0;
      tone[i] = 0;
      relief[i] = 0;
    }
    written = body;
  }

  /* The strays: a thin scatter outside the body, denser near it, so the cloud
     has an atmosphere rather than an edge.

     Placed against the body's own radius rather than in absolute model units,
     and kept close to it. Scattered freely they were the furthest particles in
     the cloud, and since normalisation scales everything so the furthest
     particle sits at the standard extent, a handful of dust a long way out
     shrank the brain itself to two thirds of the frame. */
  let bodyRadius = 0;
  for (let i = 0; i < body; i++) {
    bodyRadius = Math.max(bodyRadius, Math.hypot(out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!));
  }
  for (let i = body; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const reach = bodyRadius * (1.09 + Math.pow(random(), 2.4) * 0.3);
    out[i * 3] = Math.sin(phi) * Math.cos(theta) * reach;
    out[i * 3 + 1] = Math.cos(phi) * reach * 0.66;
    out[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * reach * 0.82;
    tone[i] = 0.55 + random() * 0.4;
    relief[i] = 0.5 + random() * 0.5;
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

/* The brain, and the structural value that goes with each particle: nought in
   the floor of a sulcus, one on the crown of a gyrus.

   The colour used to be a function of height, which reads as a light shining on
   a shape rather than as the shape having structure. Driving it from this
   instead is what makes the folds visible as folds. */
export type BrainShape = {
  shape: Shape;
  tone: Float32Array;
  /* Nought in the floor of a sulcus, one on the crown of a gyrus. Drives the
     particle's size as well as its colour: a crown carries a bigger, brighter
     pyramid, which is how a photograph of a brain reads and what makes the
     relief survive being drawn as ten thousand separate specks. */
  relief: Float32Array;
  /* What the generator multiplied its model units by to land in the texture's
     nought to one. The validator needs it to put a particle back into the
     distance field and ask how deep it is, which is the only honest way to
     assert that the cloud is still a skin rather than a solid. */
  scale: number;
};

export function brain(count: number, seed: number): BrainShape {
  const tone = new Float32Array(count);
  const relief = new Float32Array(count);
  const raw = rawBrain(count, mulberry32(seed), tone, relief);
  let radius = 0;
  for (let i = 0; i < count; i++) {
    radius = Math.max(radius, Math.hypot(raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!));
  }
  const scale = radius > 0 ? EXTENT / radius : 1;
  return { shape: normalise(raw, count), tone, relief, scale };
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

export function brainTargets(
  count: number,
  seed: number,
): { shapes: Shape[]; tone: Float32Array; relief: Float32Array } {
  const { shape, tone, relief } = brain(count, seed);
  return {
    shapes: [
      shape,
      dataField(shape, count, seed + 11),
      helix(shape, count, seed + 23),
      reassembly(shape, count, seed + 37),
    ],
    tone,
    relief,
  };
}
