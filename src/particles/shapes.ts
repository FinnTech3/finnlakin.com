import { clamp } from "./pack";

/* The shapes the particles morph between, as plain arrays of normalised
   positions. No WebGL here, so the generator script and the browser build the
   same geometry from the same code.

   The order matters. The specification is emphatic that the simulation should
   be proved against shapes with no subtlety in them before the brain arrives,
   because otherwise a wrong spring constant and a wrong asset are indis-
   tinguishable: both give you a cloud that is nearly right. A torus either has
   a hole in it or the simulation is broken. */

export type Shape = Float32Array;

/* Every shape is normalised into nought to one with the same scale factor, so
   that morphing between two of them does not also change the apparent size of
   the cloud. Half a unit of headroom each side leaves room for the explosion to
   push particles out without clipping them against the edge of the texture. */
const EXTENT = 0.34;

function normalise(points: Float32Array, count: number): Float32Array {
  let radius = 0;
  for (let i = 0; i < count; i++) {
    const x = points[i * 3]!;
    const y = points[i * 3 + 1]!;
    const z = points[i * 3 + 2]!;
    radius = Math.max(radius, Math.hypot(x, y, z));
  }
  const scale = radius > 0 ? EXTENT / radius : 1;

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    out[i] = clamp(0.5 + points[i]! * scale, 0, 1);
  }
  return out;
}

export function cube(count: number, random: () => number): Shape {
  const raw = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) raw[i] = random() * 2 - 1;
  return normalise(raw, count);
}

/* Volumetric rather than a shell. A shell is the easier thing to write and it
   is exactly what the specification warns against, because a hollow sphere and
   a hollow brain look the same from outside and only one of them is right. */
export function sphere(count: number, random: () => number): Shape {
  const raw = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    /* Cube root, so the points are evenly spread through the volume instead of
       piling up at the centre. */
    const r = Math.cbrt(random());
    raw[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    raw[i * 3 + 1] = Math.cos(phi) * r;
    raw[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  return normalise(raw, count);
}

export function torus(count: number, random: () => number): Shape {
  const major = 1;
  const minor = 0.38;
  const raw = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const around = random() * Math.PI * 2;
    const through = random() * Math.PI * 2;
    const r = minor * Math.sqrt(random());
    const ring = major + Math.cos(through) * r;
    raw[i * 3] = Math.cos(around) * ring;
    raw[i * 3 + 1] = Math.sin(through) * r;
    raw[i * 3 + 2] = Math.sin(around) * ring;
  }
  return normalise(raw, count);
}

/* Three intersecting bars. Chosen over another blob because it has corners and
   an obvious axis: if the per particle morph ordering is wrong, a cross shows
   it immediately and a cloud does not. */
export function cross(count: number, random: () => number): Shape {
  const raw = new Float32Array(count * 3);
  const thickness = 0.22;
  for (let i = 0; i < count; i++) {
    const arm = i % 3;
    const along = random() * 2 - 1;
    const a = (random() * 2 - 1) * thickness;
    const b = (random() * 2 - 1) * thickness;
    if (arm === 0) {
      raw[i * 3] = along;
      raw[i * 3 + 1] = a;
      raw[i * 3 + 2] = b;
    } else if (arm === 1) {
      raw[i * 3] = a;
      raw[i * 3 + 1] = along;
      raw[i * 3 + 2] = b;
    } else {
      raw[i * 3] = a;
      raw[i * 3 + 1] = b;
      raw[i * 3 + 2] = along;
    }
  }
  return normalise(raw, count);
}
