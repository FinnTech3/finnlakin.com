import { bandPlan } from "../src/lib/bands";
import { entryField, perimeterPoint } from "../src/particles/entrance";
import { sampleOf } from "../src/particles/extent";
import { OPENING, OPENING_CEILING_MS, openingMorph } from "../src/particles/opening";
import { chainOf, pageShapes, SHAPE_NAMES, shapeSlot } from "../src/particles/structures";
import { SEED } from "../src/particles/targets";
import { ParticleTimeline } from "../src/particles/timeline";
import { stepToward } from "../src/particles/scroll";
import {
  DEFAULTS,
  type LaneState,
  type PageLayout,
  type ParticleTimelineState,
} from "../src/particles/types";

/* Validates the two rules of the engine's motion that a browser cannot check.

   Both are things whose failure is invisible in a screenshot and too quick to
   sample on the software rasteriser the suite runs against: where the opening
   entrance starts every particle, and how fast the timeline is allowed to
   travel when the page jumps rather than scrolls.

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
    rotation: { x: 0, y: 0, z: 0 },
    mask: {
      edge: 0.6,
      side: 0,
      splits: [-1, -1],
      sides: [0, 0, 0],
      splitSoft: 0,
      inner: 0.1,
      feather: 0.045,
      gapCentre: 0.5,
      gapHalf: 0,
      gapSoft: 0.4,
      off: 1,
    },

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


/* The opening's schedule.

   Finn asked for the second line, ECONOMICS, FINANCE, SOFTWARE DEV, to stay on
   the screen a second longer. It was held for 800ms before the brain began to
   form, so it is held for 1800ms now, and what is asserted is the thing he
   asked for rather than the constants that currently deliver it: the hold is at
   least that long, nothing moves during it, and the phases either side of it
   run at the pace they always did, so the extra second is a pause and not a
   slower animation. Written out as numbers, not imported, because importing
   them would make the check agree with whatever the schedule happens to be. */
console.log("Opening");

{
  const WAS_HELD = 800;
  const ASKED_FOR = 1000;
  const hold = OPENING.brainFrom - OPENING.wordTwoTo;
  check(
    hold >= WAS_HELD + ASKED_FOR,
    `the second line is held for at least ${WAS_HELD + ASKED_FOR}ms before the brain forms`,
    `${hold}ms`,
  );

  /* Flat across the whole hold, which is what a pause is: the morph value is
     exactly one, the second line, from the moment it is formed until the brain
     starts. */
  let moving = 0;
  for (let at = OPENING.wordTwoTo; at <= OPENING.brainFrom; at += 10) {
    if (Math.abs(openingMorph(at) - 1) > 1e-9) moving += 1;
  }
  check(moving === 0, "nothing moves between the second line forming and the brain starting", `${moving} samples`);

  check(
    OPENING.wordTwoTo - OPENING.wordTwoFrom === 1200,
    "the first line becomes the second at the pace it always did",
    `${OPENING.wordTwoTo - OPENING.wordTwoFrom}ms`,
  );
  check(
    OPENING.brainTo - OPENING.brainFrom === 1300,
    "the second line becomes the brain at the pace it always did",
    `${OPENING.brainTo - OPENING.brainFrom}ms`,
  );
  check(
    OPENING.handoverAt - OPENING.brainTo === 600,
    "the hand-over follows the brain by the time it always did",
    `${OPENING.handoverAt - OPENING.brainTo}ms`,
  );
  check(
    OPENING.settleFrom > OPENING.brainFrom && OPENING.settleFrom < OPENING.handoverAt,
    "the brain starts to travel to its place after it starts forming and before the hand-over",
    `${OPENING.settleFrom}ms`,
  );
  check(
    OPENING_CEILING_MS - OPENING.handoverAt >= 2000,
    "the host's ceiling leaves two seconds past the hand-over",
    `${OPENING_CEILING_MS - OPENING.handoverAt}ms`,
  );
  console.log(
    `  second line formed at ${OPENING.wordTwoTo}ms and held for ${hold}ms; ` +
      `hand-over at ${OPENING.handoverAt}ms; ceiling ${OPENING_CEILING_MS}ms`,
  );
}

/* The timeline's speed limit.

   The call to action in the hero is an anchor to the contact section, and the
   button at the foot of the page goes back the other way, so following either
   moves the scroll the whole length of the page in one go. The eased value
   covers a proportion of whatever gap it is given, so before the cap a gap that
   size was crossed in about a frame and the cloud played every change of shape
   on the page as a flicker. On a machine drawing two frames a second there is no
   sampling rate at which a browser test can see the difference, which is why it
   is asserted here.

   Measured in bands, which is the unit the page is now cut into, and written out
   as a number here and not imported: it is the same journey time as the page's
   seven sections at four a second, over the eleven bands it has now. */
const SPEED_LIMIT = 6.5;
const PLAN = bandPlan(10);
const LAST = PLAN.length - 1;

console.log("Timeline speed");

for (const delta of [1 / 120, 1 / 60, 1 / 30, 0.25, 0.5]) {
  let worst = 0;
  let current = 0;
  /* A jump the whole length of the page, then the same in reverse, which is
     what scrolling back up from the contact section does. */
  for (const target of [...Array(8).fill(LAST), ...Array(8).fill(0)] as number[]) {
    const next = stepToward(current, target, DEFAULTS.scrollEase, delta);
    worst = Math.max(worst, Math.abs(next - current) / delta);
    current = next;
  }
  check(
    worst <= SPEED_LIMIT + 1e-9,
    `the timeline stays under ${SPEED_LIMIT} bands a second at ${delta.toFixed(4)}s a frame`,
    `reached ${worst.toFixed(3)}`,
  );
  console.log(`  ${delta.toFixed(4)}s a frame: fastest ${worst.toFixed(2)} bands a second`);
}

/* The cap must not become the whole behaviour. Ordinary scrolling moves the
   target by a fraction of a band at a time, and there the easing has to be
   what decides the motion, or the cloud would track the scrollbar exactly and
   lose the lag that makes it read as being carried. */
{
  const delta = 1 / 60;
  const eased = stepToward(0, 0.2, DEFAULTS.scrollEase, delta);
  check(
    eased < 0.2 && eased > 0,
    "a small gap is still eased rather than capped",
    `moved ${eased.toFixed(4)} of 0.2`,
  );
  check(
    Math.abs(eased / delta) < SPEED_LIMIT,
    "a small gap does not reach the cap",
    `${(eased / delta).toFixed(3)} bands a second`,
  );
}

/* And it has to arrive. A cap that is applied to the eased value rather than to
   the gap could in principle stall short of the target. */
{
  let current = 0;
  for (let i = 0; i < 600; i++) current = stepToward(current, LAST, DEFAULTS.scrollEase, 1 / 60);
  check(
    Math.abs(current - LAST) < 0.01,
    "the timeline arrives at the target",
    `${current.toFixed(4)}`,
  );
  console.log(`  arrives at ${current.toFixed(4)} of ${LAST} after ten seconds`);
}

/* The page's plan, as the validator reads it.

   The chain of shapes comes out of the plan the way it comes out of the markup:
   the same function, over the same list of slots. */
const { chain: CHAIN, index: CHAIN_OF_BAND } = chainOf(PLAN.map((band) => shapeSlot(band.shape)));

console.log("The plan");
check(
  PLAN.filter((band) => band.id.startsWith("work")).length === 5,
  "ten projects are five bands of two",
  `${PLAN.filter((band) => band.id.startsWith("work")).length} bands`,
);
{
  const work = PLAN.filter((band) => band.id.startsWith("work"));
  let alternates = true;
  for (let i = 1; i < work.length; i++) if (work[i]!.lane === work[i - 1]!.lane) alternates = false;
  check(alternates, "the work changes sides after every band");
  check(
    new Set(work.map((band) => band.shape)).size === work.length,
    "no two bands of the work are the same shape",
  );
  const changes = PLAN.filter((band, i) => i > 0 && band.lane !== PLAN[i - 1]!.lane).length;
  const morphs = CHAIN.length - 1;
  console.log(`  ${PLAN.length} bands, ${changes} changes of side, ${morphs} changes of shape`);
  check(changes >= 6, "the cloud crosses the page at least six times", `${changes}`);
  check(morphs >= 8, "the cloud changes shape at least eight times", `${morphs}`);
  check(
    CHAIN.some((slot, i) => i > 0 && slot === 0) && CHAIN[0] === 0,
    "the brain is where it starts and comes back between the other shapes",
  );
}

/* Every shape stays inside the frame and inside its lane, at every place it can
   be and on every shape of window.

   This is the assertion that replaces a habit. The composition is a size set
   from the window's height and the lane is a share of its width, so what the
   cloud reaches at a given scroll position is not a thing anybody is holding in
   their head, and the habit was to nudge a number until one screen width looked
   right. One screen width is not the set of screens. Measured on an iPad held on
   its side, which is 4 by 3, the brain was wider than its lane: the final pass
   cut it at the column's edge and the screen cut it at the other, and the same
   was true of any browser window dragged taller than it is wide.

   So every shape the page can ask for is projected through the same transform
   the shaders use, at every aspect ratio from a tall window to an ultrawide one,
   and the body of the cloud has to be inside the frame and inside its lane. The
   body is the cloud less the thin scatter of strays the brain carries a way out
   past its surface: a half of one percent of the particles at each end, which is
   what the eye and the browser tests both leave out. */
{
  const GRID = DEFAULTS.gridSize;
  const factors = { lane: DEFAULTS.factorLane, slot: DEFAULTS.factorSlot };
  const COUNT = GRID * GRID;
  const built = pageShapes(COUNT, SEED);
  /* Sampled the way the engine samples them, so the timeline under test is
     sized from the same thing as the one in the page. The checks below measure
     with every particle and their own arithmetic, and not with this. */
  const samples = built.shapes.map((shape) => sampleOf(shape, COUNT));
  const BODY = 0.005;

  /* One particle on the screen, through the transform the vertex shader applies:
     the position out of its texture's nought to one, scaled by twice the factor,
     turned about x, then y, then z, offset, and projected. */
  function screenOf(
    shape: Float32Array,
    i: number,
    at: ParticleTimelineState,
    aspect: number,
  ): { x: number; y: number } {
    const scale = 2 * at.factor;
    let x = (shape[i * 3]! - 0.5) * scale;
    let y = (shape[i * 3 + 1]! - 0.5) * scale;
    let z = (shape[i * 3 + 2]! - 0.5) * scale;
    const { x: rx, y: ry, z: rz } = at.rotation;
    const y1 = y * Math.cos(rx) - z * Math.sin(rx);
    z = y * Math.sin(rx) + z * Math.cos(rx);
    y = y1;
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    z = -x * Math.sin(ry) + z * Math.cos(ry);
    x = x1;
    const x2 = x * Math.cos(rz) - y * Math.sin(rz);
    y = x * Math.sin(rz) + y * Math.cos(rz);
    x = x2;
    const depth = Math.max(0.05, Math.abs(CAMERA_Z - at.offset.z) - z);
    const halfHeight = depth * Math.tan((CAMERA_FOV * Math.PI) / 360);
    return {
      x: (x + at.offset.x) / (halfHeight * aspect),
      y: (y + at.offset.y) / halfHeight,
    };
  }

  /* How far the body of a shape reaches each way, in the window's own units:
     minus one to one across, and up. */
  function body(shape: Float32Array, at: ParticleTimelineState, aspect: number) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < COUNT; i += 5) {
      const point = screenOf(shape, i, at, aspect);
      xs.push(point.x);
      ys.push(point.y);
    }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const pick = (list: number[], share: number) =>
      list[Math.min(list.length - 1, Math.max(0, Math.floor(list.length * share)))]!;
    return {
      left: pick(xs, BODY),
      right: pick(xs, 1 - BODY),
      bottom: pick(ys, BODY),
      top: pick(ys, 1 - BODY),
    };
  }

  /* Below the breakpoint the cloud lives in the slot under the hero's controls,
     so the phone case is swept against a slot rather than a lane: a Pixel 5's,
     363 pixels high from 488 down its 851 pixel first screen, and the smallest
     slot the timeline will draw in at all. */
  const phoneSlots: [string, PageLayout][] = [
    ["a Pixel 5's slot", { wide: false, slot: { centre: 0.2133, half: 0.2133, px: 363 } }],
    ["the smallest slot drawn in", { wide: false, slot: { centre: 0.2, half: 0.1058, px: 180 } }],
  ];

  console.log("Shapes inside the frame and their lane");
  /* A window a lane fits in is at least 1100 wide, and is any shape between a
     browser dragged tall and an ultrawide monitor. */
  const ASPECTS = [0.79, 0.9, 1.0, 1.22, 1.33, 1.44, 1.6, 1.78, 2.4];
  /* Where in the page: the hero, where the cloud opens, and three places down. */
  const BANDS = [0, 1.5, 4, LAST];
  let worstFrame = 0;
  let worstFrameAt = "";
  let widest = 0;
  let widestAt = "";
  let tightest = 1;
  let tightestAt = "";

  for (const aspect of ASPECTS) {
    for (const side of [1, -1]) {
      const line = new ParticleTimeline(factors, aspect);
      line.setShapes(samples);
      line.setLayout({ wide: true, slot: null });
      for (let link = 0; link < CHAIN.length; link++) {
        const slot = CHAIN[link]!;
        for (const band of BANDS) {
          /* The hero is the brain and nothing else is there. */
          if (band === 0 && slot !== 0) continue;
          const lane: LaneState = { here: side, hereChain: link, chain: CHAIN, seams: [] };
          const at = line.settle(band, lane);
          const reach = body(built.shapes[slot]!, at, aspect);
          const name = `${SHAPE_NAMES[slot]}, aspect ${aspect}, ${side > 0 ? "right" : "left"} lane, band ${band}`;

          /* Inside the frame. */
          const overflow = Math.max(
            Math.abs(reach.left),
            Math.abs(reach.right),
            Math.abs(reach.top),
            Math.abs(reach.bottom),
          );
          if (overflow > worstFrame) {
            worstFrame = overflow;
            worstFrameAt = name;
          }

          /* Inside the lane: the inner edge of the column is at nought point
             two either side of the middle, and the body is on the far side of it
             by however much of its own width it leaves free. */
          const edge = 0.2 * side;
          const margin = side > 0 ? reach.left - edge : edge - reach.right;
          /* How much of the lane's width the body takes, the lane being the
             eight tenths of the window the column leaves. */
          const share = (reach.right - reach.left) / 0.8;
          if (margin < tightest) {
            tightest = margin;
            tightestAt = name;
          }
          if (share > widest) {
            widest = share;
            widestAt = name;
          }
        }
      }
    }
  }
  console.log(
    `  worst reach of any body: ${worstFrame.toFixed(2)} of the half frame (${worstFrameAt})`,
  );
  console.log(
    `  smallest margin to the lane's edge: ${tightest.toFixed(3)} (${tightestAt}); ` +
      `widest share of the lane: ${widest.toFixed(2)} (${widestAt})`,
  );
  check(worstFrame <= 1, "no shape leaves the frame at any aspect or scroll position",
    `${worstFrame.toFixed(2)} of the half frame, ${worstFrameAt}`);
  check(tightest >= 0, "no shape is wider than its lane at any aspect or scroll position",
    `${tightest.toFixed(3)} short of the lane's edge, ${tightestAt}`);

  /* And on a phone, inside the slot: how far from the slot's centre each
     particle lands, as a share of the half height the final pass draws at full
     strength. Over one is a particle in the softened edge or past it, which is
     where the controls and the heading are. */
  let worstSlot = 0;
  let worstSlotAt = "";
  for (const aspect of [0.46, 0.56, 0.75]) {
    for (const [name, layout] of phoneSlots) {
      const line = new ParticleTimeline(factors, aspect);
      line.setShapes(samples);
      line.setLayout(layout);
      for (const band of [0, 0.5, 1]) {
        const at = line.settle(band);
        const reach = body(built.shapes[0]!, at, aspect);
        const core = layout.slot!.half * (1 - at.mask.gapSoft);
        const share =
          Math.max(
            Math.abs(0.5 + reach.top / 2 - layout.slot!.centre),
            Math.abs(0.5 + reach.bottom / 2 - layout.slot!.centre),
          ) / core;
        if (share > worstSlot) worstSlotAt = `${name}, band ${band}`;
        worstSlot = Math.max(worstSlot, share);
      }
    }
  }
  /* Inside the slot, which is its core and the softened edge round it: past
     that is past the strip the final pass draws in, and into the controls. */
  const SLOT_EDGE = 1 / (1 - 0.15);
  console.log(
    `  worst reach of the body in a phone's slot: ${worstSlot.toFixed(2)} of its core ` +
      `against ${SLOT_EDGE.toFixed(2)} to the edge (${worstSlotAt})`,
  );
  check(worstSlot <= SLOT_EDGE, "the cloud stays inside a phone's slot at every scroll position",
    `${worstSlot.toFixed(2)} of the core`);

  /* A crossing, in the middle, fits the seam it crosses on.

     The seam is the band of padding between two bands, eighty pixels either
     side of the boundary here, less the sixteen the scroll controller keeps as
     a margin: at 720 pixels that is a clear half height of 0.089 of the window.
     Halfway across, the cloud is in the middle of the screen where only the
     seam is drawn, so any particle outside the band is a particle cut away.
     Where halfway is depends on the cloud's own height, so it is found rather
     than assumed: the seam height at which the cloud's column flips from the
     upper band's side to the lower's. Every change of side on the page is
     swept, in the shape the cloud is above the seam and the shape it is
     below. */
  console.log("Crossings");
  const CLEAR = (80 - 16) / 720;
  let worstSeam = 0;
  let worstSeamAt = "";
  let crossings = 0;
  for (let band = 1; band < PLAN.length; band++) {
    if (PLAN[band]!.lane === PLAN[band - 1]!.lane) continue;
    const above = PLAN[band - 1]!.lane === "right" ? 1 : -1;
    const below = -above;
    for (const aspect of [1.33, 1.6, 1.78, 2.4]) {
      const line = new ParticleTimeline(factors, aspect);
      line.setShapes(samples);
      line.setLayout({ wide: true, slot: null });
      const at = (uv: number) =>
        line.settle(band, {
          here: above,
          hereChain: CHAIN_OF_BAND[band - 1]!,
          chain: CHAIN,
          seams: [
            {
              uv,
              above,
              below,
              aboveChain: CHAIN_OF_BAND[band - 1]!,
              belowChain: CHAIN_OF_BAND[band]!,
              clear: CLEAR,
              half: CLEAR,
            },
          ],
        });
      let low = 0.05;
      let high = 0.95;
      if (at(low).mask.side === at(high).mask.side) continue;
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (at(mid).mask.side === above) low = mid;
        else high = mid;
      }
      const seamUv = high;
      const state = at(seamUv);
      crossings += 1;
      for (const slot of new Set([CHAIN[CHAIN_OF_BAND[band - 1]!]!, CHAIN[CHAIN_OF_BAND[band]!]!])) {
        const reach = body(built.shapes[slot]!, state, aspect);
        const share =
          Math.max(
            Math.abs(0.5 + reach.top / 2 - seamUv),
            Math.abs(0.5 + reach.bottom / 2 - seamUv),
          ) / CLEAR;
        if (share > worstSeam) {
          worstSeamAt = `${SHAPE_NAMES[slot]}, ${PLAN[band - 1]!.id} to ${PLAN[band]!.id}, aspect ${aspect}`;
        }
        worstSeam = Math.max(worstSeam, share);
      }
    }
  }
  console.log(
    `  ${crossings} crossings swept; worst reach across a seam: ${worstSeam.toFixed(2)} of its clear half (${worstSeamAt})`,
  );
  check(crossings > 0, "there is a crossing to sweep");
  check(worstSeam <= 1, "a crossing cloud fits the seam it crosses on",
    `${worstSeam.toFixed(2)} of the clear half`);
}

if (failures > 0) {
  console.error(`\nMotion: ${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("  all motion checks passed");
