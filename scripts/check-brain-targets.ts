import {
  FOLD_DEPTH,
  baseDistance,
  foldOffset,
  landmarkPhase,
  foldPhase,
  profileDistance,
  regionAt,
} from "../src/particles/brain-anatomy";
import { brain } from "../src/particles/brain-shape";
import { pageShapes, SHAPE_NAMES } from "../src/particles/structures";
import { buildTargetSet, SEED, SLOT_COLUMNS } from "../src/particles/targets";
import { DEFAULTS } from "../src/particles/types";

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

/* The grid the engine actually builds on a desktop, not a number of its own:
   a validator that checks a different cloud from the one that ships is
   checking nothing. */
const GRID = DEFAULTS.gridSize;
const COUNT = GRID * GRID;
/* The target texture is a grid of slots, so a side of it is the grid's side times
   the slots along one. */
const SIDE = GRID * SLOT_COLUMNS;

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

/* The shapes the page asks for, in the order of its slots: what ships, and not a
   set of the same size that happens to be easier to check. */
const names = [...SHAPE_NAMES];
const built = pageShapes(COUNT, SEED);
const shapes = built.shapes;
const tones = shapes.map(() => built.tone);
const set = buildTargetSet(shapes, GRID, tones, built.relief);

console.log(`Page targets, seed ${SEED}, ${COUNT} particles in a ${GRID} by ${GRID} grid.`);

check(
  shapes.length === names.length,
  `there is a target for each of the ${names.length} shapes the page can ask for`,
  `found ${shapes.length}`,
);
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
  ["parameter texture 4", set.param4],
] as const) {
  check(data.length === COUNT * 4, `${name} is ${GRID} by ${GRID}`, `${data.length / 4} texels`);
}

finiteRange("positions", set.positions, 0, 1);
finiteRange("scales", set.scales, 0, 4);
finiteRange("colours", set.colours, 0, 8);
finiteRange("parameter texture 1", set.param1, -1, 1);
finiteRange("parameter texture 2", set.param2, 0, 1);
finiteRange("parameter texture 3", set.param3, -1, 7);
finiteRange("parameter texture 4", set.param4, 0, 1);

/* Every shape the page can arrive at has an order of its own, and the first
   shape, which the page opens on and never has to arrive at, has none. They are
   spread over two textures of four channels, so a shape's order is in the
   texture and channel its slot says. */
for (let slot = 1; slot < names.length; slot++) {
  const order = slot < 4 ? set.param2 : set.param4;
  const channel = slot < 4 ? slot : slot - 4;
  permutation(`morph to the ${names[slot]}`, order, 4, channel);
}
permutation("explosion", set.param3, 4, 3);

/* Every slot has to actually contain something. An empty one is the single
   easiest mistake to make here and it looks, from outside, like a morph that
   does nothing. */
for (let slot = 0; slot < names.length; slot++) {
  const qx = slot % SLOT_COLUMNS;
  const qy = Math.floor(slot / SLOT_COLUMNS);
  let spread = 0;
  for (let i = 0; i < COUNT; i++) {
    const gx = i % GRID;
    const gy = Math.floor(i / GRID);
    const texel = ((gy + qy * GRID) * SIDE + (gx + qx * GRID)) * 4;
    spread = Math.max(spread, Math.abs(set.positions[texel]! - 0.5));
  }
  check(spread > 0.05, `slot ${slot} (${names[slot]}) is not collapsed`, `spread ${spread.toFixed(4)}`);
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
  let outerHigh = -Infinity;
  let outerLow = Infinity;

  for (let i = 0; i < COUNT; i++) {
    const x = (shape[i * 3]! - 0.5) / scale;
    const y = (shape[i * 3 + 1]! - 0.5) / scale;
    const z = (shape[i * 3 + 2]! - 0.5) / scale;

    /* Measured against the folded surface, not the smooth solid.

       baseDistance is the solid with no folds in it, and the sampler now pushes
       the surface outward wherever the fold field is high, so a gyral crown
       stands proud of baseDistance by up to the fold depth. Measured against
       the smooth field, three quarters of the cortex reads as dust drifting
       outside the brain. What the particles actually sit on is this. */
    const smooth = baseDistance(x, y, z);
    const region = regionAt(x, y);
    /* Through foldOffset, not foldPhase, because the named clefts are part of
       where the surface is: measured against the banding alone, every particle
       on the wall of the lateral fissure reads as interior, and the skin check
       failed at 85% while the shape was exactly right. A validator that
       reconstructs the surface has to reconstruct all of it. */
    const distance =
      smooth - FOLD_DEPTH * foldOffset(x, y, foldPhase(x, y, z, region), region);

    if (distance > 0) outside += 1;
    else if (distance > -0.06) {
      onSkin += 1;
      /* Where the outermost particles sit within the smooth field. On a ball
         this is a constant; on a corrugated surface it spans the fold depth,
         because a crown is that far out and a sulcus floor is at nought. */
      if (distance > -0.012) {
        outerHigh = Math.max(outerHigh, smooth);
        outerLow = Math.min(outerLow, smooth);
      }
    } else {
      interior += 1;
      deepest = Math.min(deepest, distance);
    }
  }

  /* The assertion this whole rebuild turns on.

     Every other check here passes for a smooth ball with a stencil over it,
     which is exactly what the cortex was: the fold field decided which
     particles to throw away and moved the surface nowhere, so it read as
     texture rather than as structure. A surface that is genuinely folded puts
     its outermost particles at a range of depths in the unfolded field, and
     that range is the fold depth. A smooth one puts them all at nought. */
  const corrugation = outerHigh - outerLow;
  check(
    corrugation > FOLD_DEPTH * 0.75,
    "the cortex is corrugated rather than smooth",
    `the outer skin spans ${corrugation.toFixed(3)} against a fold depth of ${FOLD_DEPTH}`,
  );
  console.log(
    `  relief: the outer skin spans ${corrugation.toFixed(3)} of the unfolded field, ` +
      `fold depth ${FOLD_DEPTH}`,
  );

  /* The longitudinal fissure, measured in the cloud rather than in the field.

     It is the feature that makes a folded mass read as two hemispheres rather
     than as one lump, and from the three quarter view the site shows it is the
     most identifying thing in the shape. It also went unnoticed for a long time
     at a half width of 0.045, which in a cloud of ten thousand was about one
     particle across.

     Measured as the notch it cuts in the crown, not as an absence of particles.
     A fissure has walls and the walls carry cortex, so the midline band is
     nearly as dense as the band beside it and a density test reports 91% and
     calls a working fissure broken. What a fissure actually does to the shape is
     lower the surface along the midline, so this is how far the top of the
     midline band falls below the top of the band beside it.

     The ninety ninth percentile rather than the maximum: one stray particle
     from the interior share is enough to put the maximum back up to the crown
     and hide the notch entirely. */
  const highest = (from: number, to: number) => {
    const ys: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      const z = Math.abs((shape[i * 3 + 2]! - 0.5) / scale);
      if (z >= from && z < to) ys.push((shape[i * 3 + 1]! - 0.5) / scale);
    }
    ys.sort((a, b) => a - b);
    return ys[Math.floor(ys.length * 0.99)] ?? 0;
  };
  const notch = highest(0.1, 0.2) - highest(0, 0.03);
  check(
    notch > 0.08,
    "the hemispheres are parted by the longitudinal fissure",
    `the midline crown sits ${notch.toFixed(3)} below the crown beside it`,
  );
  console.log(
    `  fissure: the midline crown sits ${notch.toFixed(3)} below the crown beside it`,
  );

  /* The two named clefts, measured the same way: in the cloud, not in the
     function that made it.

     Asserting that landmarkPhase returns one on its own polyline would be
     asserting arithmetic. What can actually go wrong is the sampler: a rejection
     test that drops the walls, or an offset that never reaches the surface, and
     both leave the field perfectly correct and the brain smooth. So this reads
     how deep the particles near a cleft sit in the unfolded field against how
     deep the rest of the cortex sits. */
  let cleftDepth = 0;
  let cleftCount = 0;
  let cortexDepth = 0;
  let cortexCount = 0;
  for (let i = 0; i < COUNT; i++) {
    const x = (shape[i * 3]! - 0.5) / scale;
    const y = (shape[i * 3 + 1]! - 0.5) / scale;
    const z = (shape[i * 3 + 2]! - 0.5) / scale;
    if (regionAt(x, y) !== 0) continue;
    const smooth = baseDistance(x, y, z);
    if (smooth < -0.12) continue;
    if (landmarkPhase(x, y) > 0.7) {
      cleftDepth += smooth;
      cleftCount += 1;
    } else if (landmarkPhase(x, y) < 0.05) {
      cortexDepth += smooth;
      cortexCount += 1;
    }
  }
  const cleftMean = cleftCount > 0 ? cleftDepth / cleftCount : 0;
  const cortexMean = cortexCount > 0 ? cortexDepth / cortexCount : 0;
  const sunk = cortexMean - cleftMean;
  check(
    cleftCount > COUNT / 400,
    "the named sulci have walls rather than being empty slots",
    `${cleftCount} particles in the clefts, of ${COUNT}`,
  );
  check(
    sunk > FOLD_DEPTH * 0.4,
    "the lateral fissure and the central sulcus are cut into the cortex",
    `they sit ${sunk.toFixed(3)} deeper than the cortex beside them`,
  );
  console.log(
    `  sulci: ${cleftCount} particles in the two named clefts, sitting ` +
      `${sunk.toFixed(3)} deeper than the cortex beside them`,
  );

  /* How much of the cloud the pointer moves.

     The reach is in this same space, where the cloud's furthest particle sits
     at the extent, so the two are directly comparable and the old value of 0.18
     was 53% of the radius: a comment in types.ts called that local. Counted at
     the densest place a pointer can be put, which is the worst case.

     Not a style check. The complaint it answers is that the cursor moved too
     much of the brain, and a share of the particles is the only form of that
     statement which can be held to. */
  const reach = DEFAULTS.pointerReach;
  let worst = 0;
  for (let s = 0; s < COUNT; s += 37) {
    const cx = shape[s * 3]!;
    const cy = shape[s * 3 + 1]!;
    const cz = shape[s * 3 + 2]!;
    let near = 0;
    for (let i = 0; i < COUNT; i += 7) {
      const dx = shape[i * 3]! - cx;
      const dy = shape[i * 3 + 1]! - cy;
      const dz = shape[i * 3 + 2]! - cz;
      if (dx * dx + dy * dy + dz * dz < reach * reach) near += 1;
    }
    worst = Math.max(worst, (near * 7) / COUNT);
  }
  check(
    worst < 0.12,
    "the pointer parts a patch of the cloud rather than most of it",
    `${(worst * 100).toFixed(1)}% of the particles are inside the reach at its worst`,
  );
  console.log(
    `  pointer: reach ${reach} against an extent of 0.34, touching at most ` +
      `${(worst * 100).toFixed(1)}% of the cloud`,
  );

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
const repeat = pageShapes(COUNT, SEED);
const again = buildTargetSet(
  repeat.shapes,
  GRID,
  repeat.shapes.map(() => repeat.tone),
  repeat.relief,
);
const first = checksum(set.positions);
check(checksum(again.positions) === first, "generation is deterministic");

const sums = new Set<string>();
shapes.forEach((shape, index) => {
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < COUNT; i++) {
    const radius = Math.hypot(shape[i * 3]! - 0.5, shape[i * 3 + 1]! - 0.5, shape[i * 3 + 2]! - 0.5);
    lo = Math.min(lo, radius);
    hi = Math.max(hi, radius);
  }
  const sum = checksum(shape);
  sums.add(sum);
  console.log(`  ${names[index]!.padEnd(8)} radius ${lo.toFixed(3)} to ${hi.toFixed(3)}  checksum ${sum}`);
});
check(sums.size === shapes.length, "no two shapes are the same shape", `${sums.size} distinct of ${shapes.length}`);

/* The structures the brain turns into, and whether each reads as what it is.

   What can go wrong with a generated shape is not that it is out of range, which
   the checks above see, but that it is a blob: every one of these is a cloud of
   the same number of particles inside the same radius, and a wire frame that has
   lost its wires is a lump of the same size. So each is held to the one property
   that makes it that thing, measured in the cloud and not in the function that
   made it.

   The coordinates are read as they are stored: nought to one about a centre of
   a half, with the furthest particle at the standard extent. */
{
  const at = (name: (typeof SHAPE_NAMES)[number]) => shapes[SHAPE_NAMES.indexOf(name)]!;
  const EXTENT = 0.34;

  /* Centred on the middle of the box it fills, and out to the standard extent,
     so that a morph changes what the cloud is and not how big it is. */
  for (const name of ["surface", "skyline", "drape", "network"] as const) {
    const shape = at(name);
    const low = [1, 1, 1];
    const high = [0, 0, 0];
    let furthest = 0;
    for (let i = 0; i < COUNT; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = shape[i * 3 + axis]!;
        low[axis] = Math.min(low[axis]!, value);
        high[axis] = Math.max(high[axis]!, value);
      }
      furthest = Math.max(
        furthest,
        Math.hypot(shape[i * 3]! - 0.5, shape[i * 3 + 1]! - 0.5, shape[i * 3 + 2]! - 0.5),
      );
    }
    const off = Math.max(...low.map((value, axis) => Math.abs((value + high[axis]!) / 2 - 0.5)));
    check(off < EXTENT * 0.5, `the ${name} is centred on the middle of its box`, `${off.toFixed(3)} off`);
    check(
      Math.abs(furthest - EXTENT) < 0.002,
      `the ${name} reaches the standard extent`,
      `furthest particle at ${furthest.toFixed(4)} against ${EXTENT}`,
    );
    const spans = low.map((value, axis) => high[axis]! - value);
    check(
      Math.min(...spans) > 0.03,
      `the ${name} is solid in all three directions and not a sheet or a line`,
      `spans ${spans.map((span) => span.toFixed(3)).join(", ")}`,
    );
  }

  /* A seed-made shape starts every particle somewhere other than where it was in
     the brain, and that is the point of it: the mean distance a particle has to
     travel is a good fraction of the cloud's own radius, and a morph is a swarm
     re-forming rather than a blob being gently reshaped. */
  for (const name of ["surface", "skyline", "drape", "network"] as const) {
    const shape = at(name);
    const home = at("brain");
    let travelled = 0;
    for (let i = 0; i < COUNT; i++) {
      travelled += Math.hypot(
        shape[i * 3]! - home[i * 3]!,
        shape[i * 3 + 1]! - home[i * 3 + 1]!,
        shape[i * 3 + 2]! - home[i * 3 + 2]!,
      );
    }
    const mean = travelled / COUNT;
    check(
      mean > EXTENT * 0.5,
      `a particle has a long way to go from the brain to the ${name}`,
      `${mean.toFixed(3)} on average, against an extent of ${EXTENT}`,
    );
  }

  /* The surface is a wire frame: half of its particles sit on a few lines of
     constant strike across it, which is what makes it a plot and not a blanket.
     Counted as how much of the cloud is in the densest tenth of the slices cut
     across the strike: a ball puts about a sixth of it there, the brain about a
     fifth, and a surface with its wires about two fifths and more. */
  {
    const shape = at("surface");
    const SLICES = 400;
    const slices = new Uint32Array(SLICES);
    for (let i = 0; i < COUNT; i++) {
      const slice = Math.min(
        SLICES - 1,
        Math.max(0, Math.floor(((shape[i * 3]! - 0.5) / EXTENT + 1) * 0.5 * SLICES)),
      );
      slices[slice]! += 1;
    }
    const densest = Array.from(slices)
      .sort((a, b) => b - a)
      .slice(0, SLICES / 10)
      .reduce((total, n) => total + n, 0);
    check(
      densest / COUNT > 0.35,
      "the surface is drawn as the lines of a plot and not as a smooth sheet",
      `${((densest / COUNT) * 100).toFixed(1)}% of the particles are in the densest tenth of the slices across it`,
    );
  }

  /* The depth chart has a gap in the middle, which is the spread: the strip
     across the middle of it holds far fewer particles than the strips beside. */
  {
    const shape = at("skyline");
    let middle = 0;
    let beside = 0;
    for (let i = 0; i < COUNT; i++) {
      const across = (shape[i * 3]! - 0.5) / EXTENT;
      if (Math.abs(across) < 0.06) middle += 1;
      else if (Math.abs(across) > 0.12 && Math.abs(across) < 0.18) beside += 1;
    }
    check(
      middle < beside * 0.6,
      "the order book has a spread in the middle of it",
      `${middle} particles in the middle strip against ${beside} in the one beside it`,
    );
  }

  /* The drape flares: its hem is wider than its waist. */
  {
    const shape = at("drape");
    const widthAt = (from: number, to: number) => {
      let low = 1;
      let high = 0;
      for (let i = 0; i < COUNT; i++) {
        const up = (shape[i * 3 + 1]! - 0.5) / EXTENT;
        if (up < from || up >= to) continue;
        low = Math.min(low, shape[i * 3]!);
        high = Math.max(high, shape[i * 3]!);
      }
      return high - low;
    };
    const waist = widthAt(0.55, 1);
    const hem = widthAt(-1, -0.55);
    check(
      hem > waist * 1.5,
      "the cloth is narrow at the waist and flares to the hem",
      `${waist.toFixed(3)} wide at the top and ${hem.toFixed(3)} at the bottom`,
    );
  }

  /* The network is nodes and lines between them: a good share of its particles
     are packed into a few dense clusters and the rest are spread thin, which a
     blob is not. Counted as how much of the cloud sits in the densest hundredth
     of the cells it is divided into. */
  {
    const shape = at("network");
    const side = 16;
    const cells = new Uint32Array(side * side * side);
    for (let i = 0; i < COUNT; i++) {
      const cell = [0, 1, 2].map((axis) =>
        Math.min(side - 1, Math.max(0, Math.floor(((shape[i * 3 + axis]! - 0.5) / EXTENT + 1) * 0.5 * side))),
      );
      cells[(cell[0]! * side + cell[1]!) * side + cell[2]!]! += 1;
    }
    const sorted = Array.from(cells).sort((a, b) => b - a);
    const densest = sorted.slice(0, Math.ceil(sorted.length / 100)).reduce((total, n) => total + n, 0);
    check(
      densest / COUNT > 0.2,
      "the network has hubs in it and is not an even cloud",
      `${((densest / COUNT) * 100).toFixed(1)}% of the particles are in the densest hundredth of the cells`,
    );
  }
}

/* And the cloud still has to fill the outline it was traced from.

   The cloud is rasterised in the lateral view, which is the view the outline
   was traced in, and compared against the traced profile itself, evaluated at
   the cloud's own scale. Against the profile rather than against a stored
   snapshot of an accepted run: the snapshot had to be re-pasted every time a
   change shifted the random stream, because the strays are scattered from
   whatever draws are left over, which meant the guard failed loudest exactly
   when the shape had not moved at all.

   What this catches: the sweep, the normalisation or the fold displacement
   drifting the cloud off its own outline, which is the regression that the
   three earlier rebuilds would have needed it for.

   What it does not catch, and this is worth writing down because the comment
   here used to claim otherwise: it cannot tell a brain from a potato. An
   ellipse fitted to the same outline scores 92.0% against the traced profile
   where the cloud itself scores 93.6%, and at some resolutions it scores
   higher; a boundary band scores the ellipse higher still, because the cloud's
   edge is made of separate specks and an ellipse's is not. The brain's outline
   really is close to an ellipse by area, and what makes it read as a brain is
   the temporal hook and the gyral bumps, which are a few percent of it. So the
   shape is not guaranteed here. It is guaranteed by where the outline comes
   from, which is plate 728 of Gray's Anatomy with its provenance in
   scripts/reference/SOURCE.md, and by the corrugation assertion above, which a
   potato fails outright. */
{
  const width = 44;
  const height = 30;
  const { shape, scale } = brain(COUNT, SEED);

  /* Positions are stored normalised so the furthest particle, which is a stray,
     sits at the standard extent. So a texture unit is not a model unit, and the
     profile has to be evaluated through the same factor the generator used. */
  const perModelUnit = scale / 0.34;

  /* A cell counts as drawn when enough particles land in it, and enough is a
     share of the cloud rather than a fixed number: the body covers about three
     hundred of these cells, so this is a cell holding roughly a tenth of its
     even share. One particle counts dust, and the mask then grows a halo of
     isolated specks that moves whenever a change shifts the random stream,
     which is how this guard used to fail loudest at the moments the shape had
     not moved at all. Written as a share it survives a change to the particle
     count: at ten thousand particles and at twenty two and a half thousand it
     lands in the middle of the same plateau and reports the same overlap. */
  const DENSE_ENOUGH = Math.max(2, Math.round(COUNT / 3300));
  const counts = new Uint16Array(width * height);
  for (let i = 0; i < COUNT; i++) {
    const x = (shape[i * 3]! - 0.5) / 0.34;
    const y = (shape[i * 3 + 1]! - 0.5) / 0.34;
    const gx = Math.round(((x + 1.15) / 2.3) * (width - 1));
    const gy = Math.round(((1 - y) / 2) * (height - 1));
    if (gx >= 0 && gy >= 0 && gx < width && gy < height) counts[gy * width + gx]! += 1;
  }

  let both = 0;
  let either = 0;
  const picture: string[] = [];
  for (let gy = 0; gy < height; gy++) {
    let row = "";
    for (let gx = 0; gx < width; gx++) {
      const mx = ((gx / (width - 1)) * 2.3 - 1.15) / perModelUnit;
      const my = (1 - (gy / (height - 1)) * 2) / perModelUnit;
      /* Out to the fold depth, because a gyral crown genuinely stands that far
         proud of the traced outline. */
      const expected = profileDistance(mx, my) < FOLD_DEPTH;
      const drawn = counts[gy * width + gx]! >= DENSE_ENOUGH;
      if (drawn && expected) both += 1;
      if (drawn || expected) either += 1;
      row += drawn && expected ? "#" : drawn ? "+" : expected ? "-" : " ";
    }
    picture.push(row);
  }

  const overlap = either > 0 ? both / either : 0;
  check(
    overlap > 0.9,
    "the cloud fills the outline it was traced from",
    `${(overlap * 100).toFixed(1)}% overlap`,
  );
  console.log(`  silhouette: ${(overlap * 100).toFixed(1)}% overlap with the traced outline`);
  if (process.argv.includes("--picture")) {
    for (const row of picture) console.log(`    |${row}|`);
  }
}

if (failures > 0) {
  console.error(`\nBrain targets: ${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log(`Brain targets: clean. Position texture checksum ${first}.`);
