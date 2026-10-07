import { CAMERA_FOV, CAMERA_POSITION } from "./renderer";
import type { Shape } from "./shapes";

/* Where the body of a shape lands on the screen, measured off the shape itself.

   The timeline sizes the cloud against the room the page leaves it: the lane it
   is in, the seam it is crossing, the frame. Each of those is a question about
   how far the cloud reaches, and for a long time the answer was one number, a
   radius, taken as the same in every direction and for every shape. It was not
   the same in every direction: a brain is wide and low, a depth chart is wide
   and a good deal lower, and a helix is long and thin and on its side. It was
   not even the right number, because the shader draws a particle at twice the
   factor from the middle and the radius was written down as the factor, so
   everything sized from it was out by a half and the page's own tuning had
   grown to hide that.

   A single measurement of each shape, made once, was the second attempt and was
   wrong in a way that is worth writing down. The cloud is not drawn at the
   middle of the screen. It is drawn a long way to one side of it, and
   perspective acts on the whole of its position and not only on the body: a
   particle on the near side of the cloud is nearer the camera, so it is drawn
   larger, and so is the distance from the middle of the screen to the cloud's
   centre. Near particles are pushed outwards and far ones inwards, which is a
   shear of the cloud by its own depth, and it grows with how far from the middle
   of the screen the cloud sits, so it grows with the aspect ratio: a tilted
   helix measured as 0.87 of its lane was 1.08 of it when it was drawn there.
   No number can be taken off a shape on its own. It depends on where the cloud
   is.

   So the cloud is measured where it is, with the transform the vertex shader
   uses, on a small even sample of the shape, every time the timeline asks. What
   a reader sees is the body of the cloud and not the thin scatter of strays at
   each end of each axis, so the outermost half of one percent of the sample is
   left out, which is the same share tests/fit.spec.ts leaves out of a
   photograph, so the two are measuring the same thing. */

/* The edges of the body, in the window's own units: minus one to one across and
   up, so one is the edge of the frame. */
export type Edges = { left: number; right: number; bottom: number; top: number };

/* Where the cloud is drawn and how it is turned, which is what the shader is
   given. The offset is in the world's units and the rotation in radians. */
export type Pose = {
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

/* How many particles of a shape are looked at. A thousand is enough for the edge
   of a hundred thousand: the outermost half of one percent of it is five. */
const SAMPLES = 1024;

/* How many of them are left out at each end of each axis. */
const TAIL = 5;

/* An even sample of a shape, in the shape's own units: nought to one out of the
   texture and into minus one to one about the middle, which is what the factor
   multiplies. Drawn from a fixed sequence rather than every nth particle, so a
   shape that is generated in runs, a strand at a time or a bar at a time, is not
   sampled at its own period. */
export function sampleOf(shape: Shape, count: number): Float32Array {
  const out = new Float32Array(SAMPLES * 3);
  let state = 0x9e3779b9;
  for (let n = 0; n < SAMPLES; n++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const i = Math.min(count - 1, Math.floor((state / 4294967296) * count));
    out[n * 3] = (shape[i * 3]! - 0.5) * 2;
    out[n * 3 + 1] = (shape[i * 3 + 1]! - 0.5) * 2;
    out[n * 3 + 2] = (shape[i * 3 + 2]! - 0.5) * 2;
  }
  return out;
}

/* The outermost few seen so far at each end of each axis, kept sorted so the
   one at the cut is the edge of the body. Module level and reused, because this
   runs every frame and a frame is not a place to allocate. */
const lowX = new Float64Array(TAIL);
const highX = new Float64Array(TAIL);
const lowY = new Float64Array(TAIL);
const highY = new Float64Array(TAIL);

function insertLow(list: Float64Array, value: number) {
  if (value >= list[TAIL - 1]!) return;
  let at = TAIL - 1;
  while (at > 0 && list[at - 1]! > value) {
    list[at] = list[at - 1]!;
    at -= 1;
  }
  list[at] = value;
}

function insertHigh(list: Float64Array, value: number) {
  if (value <= list[TAIL - 1]!) return;
  let at = TAIL - 1;
  while (at > 0 && list[at - 1]! < value) {
    list[at] = list[at - 1]!;
    at -= 1;
  }
  list[at] = value;
}

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);

/* The body of a shape as drawn: each sampled particle through the vertex
   shader's transform, which is a scale to the factor, a turn about x and then y
   and then z, an offset, and a perspective division by its own distance from the
   camera. The same arithmetic as the shader's and nothing simpler. */
export function edgesOf(points: Float32Array, factor: number, at: Pose, aspect: number): Edges {
  lowX.fill(Infinity);
  lowY.fill(Infinity);
  highX.fill(-Infinity);
  highY.fill(-Infinity);

  const { x: rx, y: ry, z: rz } = at.rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const distance = Math.abs(CAMERA_POSITION[2] - at.offset.z);

  for (let n = 0; n < points.length; n += 3) {
    const px = points[n]! * factor;
    const py = points[n + 1]! * factor;
    const pz = points[n + 2]! * factor;

    const y1 = py * cosX - pz * sinX;
    const z1 = py * sinX + pz * cosX;
    const x2 = px * cosY + z1 * sinY;
    const z2 = -px * sinY + z1 * cosY;
    const x3 = x2 * cosZ - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cosZ;

    const halfHeight = Math.max(0.05, distance - z2) * TAN_HALF_FOV;
    const screenX = (x3 + at.offset.x) / (halfHeight * aspect);
    const screenY = (y3 + at.offset.y) / halfHeight;

    insertLow(lowX, screenX);
    insertHigh(highX, screenX);
    insertLow(lowY, screenY);
    insertHigh(highY, screenY);
  }

  return {
    left: lowX[TAIL - 1]!,
    right: highX[TAIL - 1]!,
    bottom: lowY[TAIL - 1]!,
    top: highY[TAIL - 1]!,
  };
}
