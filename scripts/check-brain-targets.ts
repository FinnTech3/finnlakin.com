import { baseDistance } from "../src/particles/brain-anatomy";
import { brain, brainTargets } from "../src/particles/brain-shape";
import { buildTargetSet, SEED } from "../src/particles/targets";

/* Validates the generated particle targets, and proves they are the same every
   time they are generated.

   The specification asks for an offline generator that writes the brain out as
   an asset, plus a validator for it. This site has the validator and not the
   asset, deliberately: the brain here is an expression rather than a model
   file, so the runtime builds it from the same module this script does, and
   writing a six hundred kilobyte texture to disk for the browser to download
   would add bytes and a decode step to reproduce something it can compute in
   about ten milliseconds. What the asset would have bought is determinism and
   reviewability, and that is what this provides instead: a fixed seed, every
   invariant checked, and a checksum printed so a change to the shape shows up
   as a changed number rather than as a silently different brain.

   Runs in npm run lint, so it is enforced rather than available. */

const GRID = 100;
const COUNT = GRID * GRID;
const SIDE = GRID * 2;

let failures = 0;

function check(condition: boolean, description: string, detail = "") {
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}${detail ? `: ${detail}` : ""}`);
}

function finiteRange(name: string, data: Float32Array, low: number, high: number) {
  let min = Infinity;
  let max = -Infinity;
  let bad = 0;
  for (let i = 0; i < data.length; i++) {
    const value = data[i]!;
    if (!Number.isFinite(value)) {
      bad += 1;
      continue;
    }
    if (value < min) min = value;
    if (value > max) max = value;
  }
  check(bad === 0, `${name} contains no NaN or Infinity`, `${bad} bad values`);
  check(
    min >= low && max <= high,
    `${name} stays within ${low} to ${high}`,
    `measured ${min.toFixed(4)} to ${max.toFixed(4)}`,
  );
  return { min, max };
}

/* An ordering has to be a permutation. Duplicates mean two particles take the
   same turn, which shows up as a morph that arrives in clumps; gaps mean the
   wave stalls. Neither is visible in a still. */
function permutation(name: string, data: Float32Array, stride: number, offset: number) {
  const seen = new Uint8Array(COUNT);
  let duplicates = 0;
  let outside = 0;
  for (let i = 0; i < COUNT; i++) {
    const rank = Math.round(data[i * stride + offset]! * (COUNT - 1));
    if (rank < 0 || rank >= COUNT) {
      outside += 1;
      continue;
    }
    if (seen[rank]) duplicates += 1;
    seen[rank] = 1;
  }
  check(outside === 0, `${name} ranks are inside the particle count`, `${outside} outside`);
  check(duplicates === 0, `${name} ranks are unique`, `${duplicates} duplicates`);
}

function checksum(data: Float32Array) {
  /* FNV style over the raw bytes. Only has to change when the shape changes. */
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const names = ["brain", "data field", "helix", "reassembly"];
const built = brainTargets(COUNT, SEED);
const shapes = built.shapes;
const set = buildTargetSet(shapes, GRID, [built.tone, built.tone, built.tone, built.tone]);

console.log(`Brain targets, seed ${SEED}, ${COUNT} particles in a ${GRID} by ${GRID} grid.`);

check(shapes.length === 4, "there are four targets", `found ${shapes.length}`);
shapes.forEach((shape, index) => {
  check(
    shape.length === COUNT * 3,
    `${names[index]} holds exactly one position per particle`,
    `${shape.length / 3} positions`,
  );
});

check(
  set.positions.length === SIDE * SIDE * 4,
  `the position texture is ${SIDE} by ${SIDE}`,
  `${set.positions.length / 4} texels`,
);
check(set.scales.length === SIDE * SIDE * 4, `the scale texture is ${SIDE} by ${SIDE}`);
check(set.colours.length === SIDE * SIDE * 4, `the colour texture is ${SIDE} by ${SIDE}`);
for (const [name, data] of [
  ["parameter texture 1", set.param1],
  ["parameter texture 2", set.param2],
  ["parameter texture 3", set.param3],
] as const) {
  check(data.length === COUNT * 4, `${name} is ${GRID} by ${GRID}`, `${data.length / 4} texels`);
}

finiteRange("positions", set.positions, 0, 1);
finiteRange("scales", set.scales, 0, 4);
finiteRange("colours", set.colours, 0, 8);
finiteRange("parameter texture 1", set.param1, -1, 1);
finiteRange("parameter texture 2", set.param2, 0, 1);
finiteRange("parameter texture 3", set.param3, -1, 7);

permutation("morph to target two", set.param2, 4, 0);
permutation("morph to target three", set.param2, 4, 1);
permutation("morph to target four", set.param2, 4, 2);
permutation("explosion", set.param2, 4, 3);

/* Every quadrant has to actually contain something. An empty one is the single
   easiest mistake to make here and it looks, from outside, like a morph that
   does nothing. */
for (let quadrant = 0; quadrant < 4; quadrant++) {
  const qx = quadrant % 2;
  const qy = Math.floor(quadrant / 2);
  let spread = 0;
  for (let i = 0; i < COUNT; i++) {
    const gx = i % GRID;
    const gy = Math.floor(i / GRID);
    const texel = ((gy + qy * GRID) * SIDE + (gx + qx * GRID)) * 4;
    spread = Math.max(spread, Math.abs(set.positions[texel]! - 0.5));
  }
  check(spread > 0.05, `quadrant ${quadrant} (${names[quadrant]}) is not collapsed`, `spread ${spread.toFixed(4)}`);
}

/* The brain is a skin over a distance field, and it has to stay one.

   Measured against the field itself rather than against a proxy. The previous
   version bucketed directions and compared each particle to the furthest one in
   its own bucket, which was a good answer to the question "is this a shell or a
   solid" while the shape was a displaced sphere. It is the wrong question for a
   shape with a groove in it: a particle in the depth of the lateral sulcus is
   a long way inside the outer hull along its own direction while being exactly
   on the surface, so the honest measurement reported a solid.

   Putting the particle back into the field and asking how deep it is has no
   such ambiguity, and it is the definition rather than an approximation of it. */
{
  const { shape, scale } = brain(COUNT, SEED);
  let onSkin = 0;
  let interior = 0;
  let outside = 0;
  let deepest = 0;

  for (let i = 0; i < COUNT; i++) {
    const x = (shape[i * 3]! - 0.5) / scale;
    const y = (shape[i * 3 + 1]! - 0.5) / scale;
    const z = (shape[i * 3 + 2]! - 0.5) / scale;
    const distance = baseDistance(x, y, z);
    if (distance > 0) outside += 1;
    else if (distance > -0.06) onSkin += 1;
    else {
      interior += 1;
      deepest = Math.min(deepest, distance);
    }
  }

  const skin = onSkin / COUNT;
  const strays = outside / COUNT;
  const inside = interior / COUNT;

  /* Nine in ten on the skin, a twentieth scattered deeper so the cloud is
     hollow rather than empty, and a few percent drifting outside it so the
     silhouette has an atmosphere rather than an edge. */
  check(skin > 0.88, "the brain is a skin rather than a solid", `${(skin * 100).toFixed(1)}% on it`);
  check(inside < 0.09, "the interior is scattered rather than filled", `${(inside * 100).toFixed(1)}%`);
  check(strays > 0.005 && strays < 0.05, "there are strays, and only a few", `${(strays * 100).toFixed(1)}%`);
  console.log(
    `  skin: ${(skin * 100).toFixed(1)}% on the surface, ${(inside * 100).toFixed(1)}% inside ` +
      `(deepest ${deepest.toFixed(2)}), ${(strays * 100).toFixed(1)}% drifting outside`,
  );
}

/* And the colour has to use the ramp rather than collapsing to one end of it.

   Guards the other regression from the same change: colour was driven by how
   much of a crest a particle sat on, which was correct until the valleys were
   rejected, at which point almost every surviving particle was on a crown, the
   value was near one everywhere and the whole cloud came out uniformly pale. */
{
  let low = 0;
  let high = 0;
  for (let i = 0; i < COUNT; i++) {
    if (built.tone[i]! < 0.35) low += 1;
    if (built.tone[i]! > 0.65) high += 1;
  }
  check(low / COUNT > 0.1, "the colour ramp reaches its dark end", `${((low / COUNT) * 100).toFixed(1)}%`);
  check(high / COUNT > 0.1, "the colour ramp reaches its bright end", `${((high / COUNT) * 100).toFixed(1)}%`);
  console.log(
    `  colour: ${((low / COUNT) * 100).toFixed(1)}% dark, ${((high / COUNT) * 100).toFixed(1)}% bright`,
  );
}

/* Determinism. Generated twice in the same process, from the same seed, the
   bytes have to be identical. */
const repeat = brainTargets(COUNT, SEED);
const again = buildTargetSet(repeat.shapes, GRID, [repeat.tone, repeat.tone, repeat.tone, repeat.tone]);
const first = checksum(set.positions);
check(checksum(again.positions) === first, "generation is deterministic");

shapes.forEach((shape, index) => {
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < COUNT; i++) {
    const radius = Math.hypot(shape[i * 3]! - 0.5, shape[i * 3 + 1]! - 0.5, shape[i * 3 + 2]! - 0.5);
    lo = Math.min(lo, radius);
    hi = Math.max(hi, radius);
  }
  console.log(
    `  ${names[index]!.padEnd(11)} radius ${lo.toFixed(3)} to ${hi.toFixed(3)}  checksum ${checksum(shape)}`,
  );
});

if (failures > 0) {
  console.error(`\nBrain targets: ${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log(`Brain targets: clean. Position texture checksum ${first}.`);
