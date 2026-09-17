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
   lateral sulcus pushes it back up again.

   It also returns the fold phase it used, as a fourth number. That used to be
   recomputed by the caller from the displaced point, which is a slightly
   different position from the one the displacement was derived at, so the crest
   value and the fold that produced it disagreed by a little everywhere. Now
   there is one number and it is the right one. */
function surfacePoint(index: number, count: number): [number, number, number, number] {
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
  /* The fold frequency, raised a long way.

     At the wavelengths this started with there were about two ridges across the
     whole brain, which is a lobed potato rather than a cortex: emptying the
     sulci made no visible difference because there were barely any sulci to
     empty. A real cortex has something like a dozen visible gyri across it, so
     the frequency goes up and the amplitude comes down, giving a corrugated
     surface instead of a lumpy one. */
  const phase =
    Math.sin(px * 13.5 + pz * 5.5) * 0.55 +
    Math.sin(py * 15.5 + px * 6.5) * 0.3 +
    Math.sin(pz * 17.5 + py * 8.0) * 0.15;
  const length = Math.hypot(px, py, pz) || 1;
  const displacement = phase * 0.075;
  px += (px / length) * displacement;
  py += (py / length) * displacement;
  pz += (pz / length) * displacement;

  /* The longitudinal fissure: a groove down the midline separating the two
     hemispheres. */
  py -= Math.exp(-(pz * pz) * 45) * Math.max(0, py) * 0.17;

  /* Nought in the depth of a sulcus, one on the crown of a gyrus. */
  return [px, py, pz, (phase + 1) / 2];
}

/* Raw model space, before normalisation into the texture's nought to one. */
/* How many directions a particle may try before it settles for the last one.
   Twenty four is generous: at the acceptance curve below, the chance of
   reaching it is vanishing, and it exists so the loop cannot run away. */
const MAX_ATTEMPTS = 24;

/* How deep the populated skin goes, as a fraction of the radius. */
const SKIN_THICKNESS = 0.075;

/* And the fraction scattered through the interior, so it is hollow rather than
   empty. */
const INTERIOR_SHARE = 0.05;

function rawBrain(count: number, random: () => number, tone: Float32Array): Float32Array {
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
      /* Rejection sampling, and this is the change that matters most.

         The previous version computed how much of a crest a direction was on
         and then kept the particle either way, moving the ones it meant to
         reject six percent inward instead of removing them. So the sulci were
         never empty: every particle that should have been taken out of a
         valley was still sitting in it, a fraction closer to the centre. From
         outside, a folded cortex and a smooth one look identical when the
         grooves are full, which is exactly why the brain read as a fuzzy
         potato however much the folds were deepened.

         Here a direction that lands in a valley is thrown away and another is
         drawn. The gaps are the whole point: a fold is visible because of what
         is not there. */
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let crest = 0;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const direction = Math.floor(random() * cortex * 4);
        const candidate = surfacePoint(direction, cortex * 4);
        crest = candidate[3];
        sx = candidate[0];
        sy = candidate[1];
        sz = candidate[2];
        /* Cubic, so a crown is kept almost always and the floor of a sulcus
           almost never. The last attempt is taken whatever it is, so this
           always terminates and the particle count is exact. */
        if (random() < Math.pow(crest, 2.4) || attempt === MAX_ATTEMPTS - 1) break;
      }

      /* A skin, not a solid. Finn asked for something you can see through, with
         the far surface showing behind the near one, and the arithmetic agrees:
         a shell 42 percent of the radius thick, which is what this was, spends
         most of its particles in the interior where nothing can see them, and
         the ones it spends there are the ones filling in the folds. A twentieth
         are still scattered deep so the cloud does not read as a balloon when
         it turns or comes apart. */
      const inside = random() < INTERIOR_SHARE;
      const depth = inside
        ? 0.35 + random() * 0.5
        : 1 - SKIN_THICKNESS * Math.pow(random(), 1.5);

      out[i * 3] = sx * depth + (random() - 0.5) * 0.012;
      out[i * 3 + 1] = sy * depth + (random() - 0.5) * 0.012;
      out[i * 3 + 2] = sz * depth + (random() - 0.5) * 0.012;
      /* Colour cannot come from the crest, which was the first thing tried and
         is wrong for an instructive reason: once the valleys are rejected,
         almost every surviving particle is on a crown, so the crest is near one
         everywhere and the whole cloud collapses to the top of the ramp. It
         came out uniformly pale.

         What still varies across a cortex of crowns is which part of it you are
         looking at, so the colour follows a slow field over the surface. Broad
         regions differ, neighbours do not, and the folds are read from the gaps
         between them rather than from their colour. */
      const region =
        Math.sin(sx * 1.9 + 0.4) * 0.5 + Math.sin(sy * 2.3 - 0.7) * 0.3 + Math.sin(sz * 1.5) * 0.2;
      tone[i] = clamp(0.5 + region * 0.5, 0, 1) * (inside ? 0.4 : 1);
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
      /* The foliation is the cerebellum's own structure, so it drives the
         colour there the way the gyri do on the cortex. */
      tone[i] = 0.45 + (ripple / 0.02) * 0.3;
      continue;
    }

    /* The stem, a short tapering column below the join. Shortened: at its first
       length it hung well below the cerebellum and read as a tail rather than as
       the top of a brain stem that continues out of frame. */
    const t = random();
    const spread = 0.11 * (1 - t * 0.4);
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * spread;
    out[i * 3] = 0.62 + Math.cos(theta) * r + noise(i, 3) * 0.02;
    out[i * 3 + 1] = -0.6 - t * 0.2;
    out[i * 3 + 2] = Math.sin(theta) * r;
    /* The stem is smooth and in shadow. */
    tone[i] = 0.18 + noise(i, 5) * 0.12;
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
export type BrainShape = { shape: Shape; tone: Float32Array };

export function brain(count: number, seed: number): BrainShape {
  const tone = new Float32Array(count);
  const shape = normalise(rawBrain(count, mulberry32(seed), tone), count);
  return { shape, tone };
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

export function brainTargets(count: number, seed: number): { shapes: Shape[]; tone: Float32Array } {
  const { shape, tone } = brain(count, seed);
  return {
    shapes: [
      shape,
      dataField(shape, count, seed + 11),
      helix(shape, count, seed + 23),
      reassembly(shape, count, seed + 37),
    ],
    tone,
  };
}
