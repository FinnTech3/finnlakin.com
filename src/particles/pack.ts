/* Data helpers shared by the engine and the asset generator that builds its
   textures. Nothing here touches the DOM or WebGL, so the same code runs in the
   browser and under node, which is the point: the ordering the generator writes
   into a texture and the ordering the shader expects to read cannot drift if
   there is one function that produces it. */

/* Deterministic, seedable, and fast enough to fill a hundred thousand channels
   without anybody noticing. The specification asks for a fixed seed so that the
   generated brain is identical every time it is built, which is what makes the
   asset reviewable in a diff rather than a binary that changes on every run. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const floatView = new Float32Array(1);
const intView = new Int32Array(floatView.buffer);

/* Single precision to half precision, by the usual bit manipulation rather than
   by a library. Half float positions are normalised nought to one here, where
   the representable step is about a two thousandth, which on a brain a few
   hundred pixels wide is well under a pixel. */
export function toHalf(value: number): number {
  floatView[0] = value;
  const x = intView[0]!;
  let bits = (x >> 16) & 0x8000;
  let mantissa = (x >> 12) & 0x07ff;
  const exponent = (x >> 23) & 0xff;

  if (exponent < 103) return bits;
  if (exponent > 142) {
    bits |= 0x7c00;
    bits |= (exponent === 255 ? 0 : 1) && x & 0x007fffff;
    return bits;
  }
  if (exponent < 113) {
    mantissa |= 0x0800;
    bits |= (mantissa >> (114 - exponent)) + ((mantissa >> (113 - exponent)) & 1);
    return bits;
  }
  bits |= ((exponent - 112) << 10) | (mantissa >> 1);
  bits += mantissa & 1;
  return bits;
}

export function toHalfArray(source: Float32Array): Uint16Array {
  const out = new Uint16Array(source.length);
  for (let i = 0; i < source.length; i++) out[i] = toHalf(source[i]!);
  return out;
}

/* The order each particle takes its turn in, for one morph target.

   The whole reason the morph reads as a wave rather than as everything moving
   at once is that each particle's transition is delayed by its own place in an
   ordering, and the ordering is spatial rather than random: sort along an axis
   and the change sweeps across the shape.

   The correspondence between a particle's index and its order is the thing that
   must survive. Sorting the positions and keeping the sorted array is the
   obvious mistake, and it silently reassigns every particle to somebody else's
   place, which looks like the shape scrambling on the first morph. */
export function orderAlongAxis(
  positions: Float32Array,
  count: number,
  axis: 0 | 1 | 2,
  descending: boolean,
): Float32Array {
  const pairs: { index: number; value: number }[] = new Array(count);
  for (let i = 0; i < count; i++) {
    pairs[i] = { index: i, value: positions[i * 3 + axis]! };
  }
  pairs.sort((a, b) => (descending ? b.value - a.value : a.value - b.value));

  /* Written back against the original index, not against the sorted one. */
  const order = new Float32Array(count);
  for (let rank = 0; rank < count; rank++) order[pairs[rank]!.index] = rank;
  return order;
}

/* A shuffle of the particle indices, used when the target generator decides
   which particle goes where.

   This is load bearing for the quality tiers. A lower tier draws the first N
   instances and no more, so if particle index tracked position in any way, a
   phone would be shown the left half of a brain. Shuffled, the first N are an
   even sample of the whole shape and a phone gets a sparser brain rather than
   most of one. */
export function shuffled(count: number, random: () => number): Uint32Array {
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = order[i]!;
    order[i] = order[j]!;
    order[j] = swap;
  }
  return order;
}

export function clamp(value: number, low: number, high: number) {
  return value < low ? low : value > high ? high : value;
}

/* Linear remap with the output clamped to whichever end is smaller, which is
   what makes a stack of these compose into a timeline: each one contributes
   nothing until the progress enters its window and holds its full contribution
   after it leaves. */
export function mapClamped(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  const span = inMax - inMin;
  const t = span === 0 ? 0 : (value - inMin) / span;
  const mapped = outMin + t * (outMax - outMin);
  return clamp(mapped, Math.min(outMin, outMax), Math.max(outMin, outMax));
}

/* The specification's easing for the opening reveal. Slow at both ends and very
   fast through the middle, which is what makes the particles look like they are
   being pulled into place rather than sliding there. */
export function qinticInOut(x: number) {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}
