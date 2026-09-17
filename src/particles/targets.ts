import { mulberry32, orderAlongAxis, shuffled } from "./pack";
import { sampleRamp, WARM, WARM_SHARE, hexToLinear } from "./palette";
import { cross, cube, sphere, torus, type Shape } from "./shapes";

/* Packing four shapes into the quadrants of one texture, and building the three
   parameter textures that decide how each particle behaves inside them.

   The quadrant layout is the reason there is only one texture bind for four
   shapes: a particle samples its own coordinate four times with a different
   half unit offset each time, and gets its position in each of the four shapes
   it can become. */

export const SEED = 1337;

export type TargetSet = {
  /* 200 x 200 x RGBA. Positions normalised nought to one. */
  positions: Float32Array;
  scales: Float32Array;
  colours: Float32Array;
  /* 100 x 100 x RGBA each. */
  param1: Float32Array;
  param2: Float32Array;
  param3: Float32Array;
  count: number;
  gridSize: number;
};

const QUADRANTS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

/* Writes one shape into one quadrant of a 200 x 200 buffer. Particle i sits at
   grid position (i mod side, i div side), and the quadrant offset moves it into
   its quarter of the texture. */
function writeQuadrant(
  destination: Float32Array,
  quadrant: number,
  gridSize: number,
  channels: (index: number) => [number, number, number],
) {
  const width = gridSize * 2;
  const [qx, qy] = QUADRANTS[quadrant]!;
  const count = gridSize * gridSize;

  for (let i = 0; i < count; i++) {
    const gx = i % gridSize;
    const gy = Math.floor(i / gridSize);
    const texel = ((gy + qy * gridSize) * width + (gx + qx * gridSize)) * 4;
    const [r, g, b] = channels(i);
    destination[texel] = r;
    destination[texel + 1] = g;
    destination[texel + 2] = b;
    destination[texel + 3] = 1;
  }
}

/* Per particle size. Most values close to one, with mild variation: the
   specification is explicit that large random differences are wrong, and it is
   right. A cloud where a few particles are four times the size of their
   neighbours reads as a rendering fault rather than as depth. */
function scaleFor(random: () => number) {
  return 0.72 + random() * 0.62;
}

/* Colour along the ramp rather than one of a handful of fixed values, with the
   warm accent injected sparsely. Position along the ramp is driven by height
   within the shape plus a little noise, so the cloud is cooler low and brighter
   high and neighbouring particles still differ. */
function colourFor(shape: Shape, index: number, random: () => number) {
  if (random() < WARM_SHARE) return hexToLinear(WARM);
  const height = shape[index * 3 + 1] ?? 0.5;
  /* Held short of the top of the ramp. Run to the end, the crest of the cortex
     came out pure white, and once the bloom is over it there is no colour left
     in the brightest third of the cloud at all. */
  const t = Math.min(0.84, Math.max(0, (height - 0.3) / 0.46 + (random() - 0.5) * 0.4));
  return sampleRamp(t);
}

/* The four orderings that make a morph sweep rather than jump, each sorted
   along a different axis and direction so that consecutive transitions travel
   across the shape in different directions instead of all sweeping the same
   way. Stored normalised, and multiplied back up in the shader: a raw rank of
   nine thousand is beyond the range where a half float texture can hold
   consecutive integers apart, and on a machine that falls back to half float
   the wave would come out in visible steps. */
function orderings(shapes: Shape[], count: number) {
  return {
    toSecond: orderAlongAxis(shapes[1]!, count, 0, true),
    toThird: orderAlongAxis(shapes[2]!, count, 1, true),
    toFourth: orderAlongAxis(shapes[3]!, count, 1, false),
    explosion: orderAlongAxis(shapes[0]!, count, 0, false),
  };
}

export function buildTargetSet(shapes: Shape[], gridSize: number): TargetSet {
  const count = gridSize * gridSize;
  const width = gridSize * 2;
  const random = mulberry32(SEED);

  const positions = new Float32Array(width * width * 4);
  const scales = new Float32Array(width * width * 4);
  const colours = new Float32Array(width * width * 4);

  for (let q = 0; q < 4; q++) {
    const shape = shapes[q]!;
    writeQuadrant(positions, q, gridSize, (i) => [
      shape[i * 3]!,
      shape[i * 3 + 1]!,
      shape[i * 3 + 2]!,
    ]);
    const scaleRandom = mulberry32(SEED + q * 17);
    writeQuadrant(scales, q, gridSize, () => {
      const s = scaleFor(scaleRandom);
      return [s, s, s];
    });
    const colourRandom = mulberry32(SEED + q * 29);
    writeQuadrant(colours, q, gridSize, (i) => colourFor(shape, i, colourRandom));
  }

  const order = orderings(shapes, count);
  /* Which particle is drawn first when a lower quality level draws fewer of
     them. Shuffled, so a phone gets an even sample of the whole shape rather
     than whichever end of it the index happened to start at. */
  const display = shuffled(count, mulberry32(SEED + 101));

  const param1 = new Float32Array(count * 4);
  const param2 = new Float32Array(count * 4);
  const param3 = new Float32Array(count * 4);
  const denominator = Math.max(1, count - 1);

  for (let i = 0; i < count; i++) {
    const signed = i % 2 === 0 ? random() : -random();
    param1[i * 4] = signed;
    param1[i * 4 + 1] = Math.floor(i / gridSize) / (gridSize * 2) + 0.0025;
    param1[i * 4 + 2] = display[i]! / denominator;
    /* A tiny per particle variation in the spring, so the cloud does not settle
       in unison. */
    param1[i * 4 + 3] = (random() * 2 - 1) * 0.0001;

    param2[i * 4] = order.toSecond[i]! / denominator;
    param2[i * 4 + 1] = order.toThird[i]! / denominator;
    param2[i * 4 + 2] = order.toFourth[i]! / denominator;
    param2[i * 4 + 3] = order.explosion[i]! / denominator;

    param3[i * 4] = 1 + 5 * random();
    param3[i * 4 + 1] = 2 * random() - 1;
    param3[i * 4 + 2] = (shapes[0]![i * 3]! - 0.5) * 2;
    param3[i * 4 + 3] = 0;
  }

  return { positions, scales, colours, param1, param2, param3, count, gridSize };
}

/* The shapes the simulation is proved against before the brain exists. A torus
   either has a hole in it or something is wrong, which is exactly the property
   a first target needs and exactly the property a brain does not have. */
export function testShapes(gridSize: number): Shape[] {
  const count = gridSize * gridSize;
  return [
    sphere(count, mulberry32(SEED + 1)),
    cube(count, mulberry32(SEED + 2)),
    torus(count, mulberry32(SEED + 3)),
    cross(count, mulberry32(SEED + 4)),
  ];
}
