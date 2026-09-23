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
/* How big one particle is drawn.

   Driven by the surface it sits on, not only by a random. It used to be purely
   random, which quietly undid the folds: a particle in the floor of a sulcus
   came out the same size and brightness as one on a crown, so however deeply
   the surface was corrugated the rendering flattened it straight back. A crown
   now carries a bigger pyramid, a sulcus a smaller one, and the variation that
   was here before rides on top so the cloud does not come out mechanical. */
function scaleFor(random: () => number, relief: number | undefined) {
  const spread = 0.62 + random() * 0.5;
  if (relief === undefined) return spread;
  return spread * (0.62 + relief * 0.72);
}

/* Colour along the ramp rather than one of a handful of fixed values, with the
   warm accent injected sparsely.

   Position along the ramp comes from the shape's own structure where the shape
   has any: nought in the floor of a sulcus, one on the crown of a gyrus, so the
   folds are lit by being coloured rather than by a light. Driven by height, as
   it was, the cloud came out pale at the top and blue at the bottom, which
   reads as a lamp above a featureless object and is most of why the brain did
   not look like a brain.

   Shapes with no structure of their own, the words in the opening animation,
   fall back to height, where a vertical gradient is exactly right. */
/* How much of a particle's place on the ramp is decided by the fold it sits on
   rather than by which region of the surface it is in.

   Not all of it, and that is the whole difficulty. Driven by the fold alone the
   cloud collapses to one end of the ramp, because the sulci are thinned and
   most surviving particles are near a crown. Driven by the region alone, which
   is what shipped, a crown and the floor of the sulcus beside it come out the
   same colour: the relief reached the renderer as a size and nothing else, so
   the folds were drawn as bigger and smaller specks of identical brightness and
   the corrugation the sampler had gone to such trouble to build was flattened
   back out at the last step. Measured over the generated cloud, a share of
   0.45 keeps the ramp spanning its whole width while giving a crown about half
   a ramp of separation from the sulcus it stands over. */
const RELIEF_SHARE = 0.45;

function colourFor(
  shape: Shape,
  index: number,
  random: () => number,
  tone: Float32Array | null,
  relief: Float32Array | null,
) {
  if (random() < WARM_SHARE) return hexToLinear(WARM);

  const structure = tone ? tone[index] : undefined;
  const region =
    structure === undefined ? ((shape[index * 3 + 1] ?? 0.5) - 0.3) / 0.46 : structure;
  const base =
    relief && structure !== undefined
      ? region * (1 - RELIEF_SHARE) + relief[index]! * RELIEF_SHARE
      : region;

  /* Held short of the top of the ramp. Run to the end, the crowns came out pure
     white, and once the bloom is over them there is no colour left in the
     brightest third of the cloud at all. */
  const t = Math.min(0.86, Math.max(0, base + (random() - 0.5) * 0.28));
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

/* One structural tone array per quadrant, or null for a shape that has no
   structure of its own. The opening animation's texture holds two words and two
   brains, and they want different things: a word reads best as a vertical
   gradient, a brain as its own folds. */
export function buildTargetSet(
  shapes: Shape[],
  gridSize: number,
  tones: (Float32Array | null)[] = [],
  relief: Float32Array | null = null,
): TargetSet {
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
    writeQuadrant(scales, q, gridSize, (i) => {
      const s = scaleFor(scaleRandom, relief ? relief[i] : undefined);
      return [s, s, s];
    });
    const colourRandom = mulberry32(SEED + q * 29);
    const quadrantTone = tones[q] ?? null;
    writeQuadrant(colours, q, gridSize, (i) =>
      colourFor(shape, i, colourRandom, quadrantTone, relief),
    );
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

    /* How far the explosion throws this particle, as a multiple of its own
       distance from the centre of the cloud.

       It was 1 + 5 * random(), so a particle could be flung six times its own
       radius out. Measured, that put the cloud's reach at 1.74 times the half
       width of the screen and 1.66 times the half height: most of a dispersed
       cloud was off the edge, and what a reader saw was not a brain coming
       apart but a few shards drifting through an empty frame. At 1 + 2.2 the
       dispersion is still a dispersion and it stays in the picture. */
    param3[i * 4] = 1 + 2.2 * random();
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
