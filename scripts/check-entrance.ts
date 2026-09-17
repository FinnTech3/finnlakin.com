import { entryField, perimeterPoint } from "../src/particles/entrance";
import type { ParticleTimelineState } from "../src/particles/types";

/* Validates where the opening entrance starts every particle.

   The entrance is the one part of the engine whose correctness is invisible in
   a still: a particle seeded a little inside the frame instead of a little
   outside it looks, in a screenshot, exactly like a particle that has already
   arrived. So the two properties that actually matter are asserted here, on the
   processor, where they can be counted rather than looked at.

   The first is that every point really is off screen, and the second is that
   the four edges are used in proportion to their length rather than a quarter
   each. Both are checked by projecting the seeded positions forward again with
   a transform written independently of the inverse the engine uses, so a sign
   error in that inverse shows up as particles landing somewhere other than the
   rectangle they were placed on.

   Runs in npm run lint, so it is enforced rather than available. */

const SAMPLES = 20000;
/* The value entrance.ts places the rectangle at. Duplicated deliberately: this
   is the assertion, and importing the number would make it agree with itself. */
const EXPECTED_OVERSHOOT = 1.25;

let failures = 0;

function check(condition: boolean, description: string, detail = "") {
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}${detail ? `: ${detail}` : ""}`);
}

/* The camera, from renderer.ts. Same reasoning as the overshoot: written out
   rather than imported, so that a change to the camera is a failure here and a
   decision, instead of propagating silently into the entrance. */
const CAMERA_Z = 10;
const CAMERA_FOV = 50;

/* Cloud space back to screen space: scale up, rotate X then Y then Z, offset,
   and project. The engine's inverse takes the rotations off in the opposite
   order with the opposite sign, so this composes with it to the identity and
   nothing else does.

   The projection is a real perspective divide rather than a division by the
   half extents at the cloud's own plane, because the entrance places particles
   at a spread of depths and the whole point of placing them along the ray is
   that a nearer one is drawn narrower. Flattened, this would report the ones
   entering from behind as being outside the frame when they are not. */
function toScreen(point: [number, number, number], timeline: ParticleTimelineState, aspect: number) {
  const depth = Math.abs(CAMERA_Z - timeline.offset.z);

  const f = 2 * timeline.factor;
  let x = (point[0] - 0.5) * f;
  let y = (point[1] - 0.5) * f;
  let z = (point[2] - 0.5) * f;

  const { x: rx, y: ry, z: rz } = timeline.rotation;
  const y1 = y * Math.cos(rx) - z * Math.sin(rx);
  z = y * Math.sin(rx) + z * Math.cos(rx);
  y = y1;

  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  z = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x1;

  const x2 = x * Math.cos(rz) - y * Math.sin(rz);
  y = x * Math.sin(rz) + y * Math.cos(rz);
  x = x2;

  const distance = Math.max(0.05, depth - z);
  const halfHeight = distance * Math.tan((CAMERA_FOV * Math.PI) / 360);
  return {
    x: (x + timeline.offset.x) / (halfHeight * aspect),
    y: (y + timeline.offset.y) / halfHeight,
  };
}

function state(partial: Partial<ParticleTimelineState>): ParticleTimelineState {
  return {
    offset: { x: 0, y: 0, z: 0 },
    explode: 0,
    factor: 4.35,
    progress: 0,
    progress2: 0,
    rotation: { x: 0, y: 0, z: 0 },
    contentDim: 0,
    ...partial,
  };
}

/* A plain linear congruential generator rather than the engine's, so that the
   sample here is not the sample the engine happens to take. */
function sequence(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

console.log("Entrance");

for (const aspect of [0.46, 1, 1.78, 2.4]) {
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  let minEdge = Infinity;

  for (let i = 0; i < SAMPLES; i++) {
    const point = perimeterPoint(i / SAMPLES, aspect);
    minEdge = Math.min(minEdge, Math.max(Math.abs(point.x), Math.abs(point.y)));
    if (point.y >= EXPECTED_OVERSHOOT - 1e-9) counts.top += 1;
    else if (point.y <= -EXPECTED_OVERSHOOT + 1e-9) counts.bottom += 1;
    else if (point.x < 0) counts.left += 1;
    else counts.right += 1;
  }

  const total = counts.top + counts.bottom + counts.left + counts.right;
  check(total === SAMPLES, `every sample at aspect ${aspect} lands on an edge`, `${total}`);
  check(
    Math.abs(minEdge - EXPECTED_OVERSHOOT) < 1e-9,
    `no sample at aspect ${aspect} is inside the viewport`,
    `closest ${minEdge.toFixed(4)}`,
  );

  for (const [name, n] of Object.entries(counts)) {
    check(n > SAMPLES * 0.05, `the ${name} edge is used at aspect ${aspect}`, `${n} of ${SAMPLES}`);
  }

  /* Even density in world units means each edge's share of the points equals
     its share of the perimeter. On a wide monitor that is well away from a
     quarter each, which is the whole reason for weighting it. */
  const share = aspect / (1 + aspect) / 2;
  for (const [name, expected] of [
    ["top", share],
    ["bottom", share],
    ["left", 0.5 - share],
    ["right", 0.5 - share],
  ] as const) {
    const measured = counts[name] / SAMPLES;
    check(
      Math.abs(measured - expected) < 0.005,
      `the ${name} edge at aspect ${aspect} carries its share of the perimeter`,
      `${(measured * 100).toFixed(1)}% against ${(expected * 100).toFixed(1)}%`,
    );
  }

  const horizontal = ((counts.top + counts.bottom) / SAMPLES) * 100;
  console.log(
    `  aspect ${aspect}: ${horizontal.toFixed(1)}% along the top and bottom, ` +
      `${(100 - horizontal).toFixed(1)}% down the sides`,
  );
}

/* And the round trip, against the composition the page actually opens in:
   offset to the right and down, turned three quarters on, at the desktop
   factor. If the inverse were wrong in any of those, the particles would be
   seeded somewhere that is not the edge of the screen and this is where it
   shows. */
const opening = state({
  offset: { x: 3, y: -1.19, z: 0 },
  rotation: { x: 0, y: -0.25 * Math.PI, z: 0.06 },
  factor: 4.35,
});

for (const aspect of [0.46, 1.78]) {
  const random = sequence(20260917);
  const field = entryField(opening, aspect, random);
  const out = new Float32Array(4);
  let worst = Infinity;
  let offRectangle = 0;

  for (let i = 0; i < 4000; i++) {
    field(out, 0);
    const screen = toScreen([out[0]!, out[1]!, out[2]!], opening, aspect);
    const edge = Math.max(Math.abs(screen.x), Math.abs(screen.y));
    worst = Math.min(worst, edge);
    if (Math.abs(edge - EXPECTED_OVERSHOOT) > 1e-6) offRectangle += 1;
  }

  check(
    offRectangle === 0,
    `every seeded particle at aspect ${aspect} projects back onto the entry rectangle`,
    `${offRectangle} of 4000 off it, closest ${worst.toFixed(3)}`,
  );
  console.log(`  aspect ${aspect}: closest seeded particle sits at ${worst.toFixed(3)} of the frame`);
}

if (failures > 0) {
  console.error(`\n${failures} entrance check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("  all entrance checks passed");
