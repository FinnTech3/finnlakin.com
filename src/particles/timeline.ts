import { clamp, easeForFrame, mapClamped } from "./pack";
import { edgesOf, type Edges, type Pose } from "./extent";
import { CAMERA_FOV, CAMERA_POSITION } from "./renderer";
import type {
  CloudMask,
  LaneSeam,
  LaneState,
  PageLayout,
  ParticleTimelineState,
} from "./types";

/* Where the page is in, everything the renderer needs out.

   The page is a column of bands, and each band says which side the cloud keeps
   and which shape it wants to be: this is the choreography that follows from
   what they say. The cloud sits in its band's lane as the shape its band asks
   for, and where two bands differ it gathers itself up, crosses the text-free
   seam between them, and arrives as what the next band asked for.

   It used to be a stack of clamped ramps across a fixed run of seven sections,
   each contributing nothing until the scroll entered its window: the cloud
   drifted, came apart over the whole of the work, reassembled as something
   else late in the page, turned, and gathered again. That put the one change of
   shape after the first two thirds of the page and left the long run of project
   entries with a dispersed haze of brain behind them. It is a rule about
   seams now, and a seam is wherever the page changes its mind.

   Nothing is set from the scroll position directly. Every output eases towards
   its target, which is the whole reason scrolling backwards reverses the
   animation smoothly instead of snapping to wherever the page now is. */

/* The cloud's resting place. The specification's own base, and it sits low
   because the brain reads better with its mass below the centre line of the
   screen than straddling it. */
const BASE = { x: 0, y: -1.19, z: 0 };

/* Applied on top of the timeline rotation and kept separate from it.

   Eighteen degrees, not forty five. The shape is swept from an outline traced
   off an anatomical plate, and an outline is only an outline from the direction
   it was drawn: measured, the projection is widest at zero yaw and a sixth
   narrower at a quarter turn, where the silhouette that took four attempts to
   get right is foreshortened into an oval. Enough turn to say the cloud is a
   solid, not enough to throw away the view that identifies it. The reference
   shows its own brain at very nearly this angle, for the same reason. */
export const INITIAL_YAW = -0.1 * Math.PI;

/* The lane the cloud travels down, derived rather than chosen.

   This is the share of the viewport the bands leave empty beside their content,
   and it is --lane in globals.css: the two have to be changed together, which
   is why both say so. Everything else here follows from it and from the camera,
   so the cloud goes where the layout says the gap is at any screen width rather
   than at the one width it was tuned on.

   Half the viewport, in the world units the offset is in, is the distance from
   the camera to the cloud's plane times the tangent of half the field of view,
   times the aspect. The lane's centre then sits (1 - lane) of that out from the
   middle and the content's inner edge at (1 - 2 * lane). */
const LANE_FRACTION = 0.4;

function halfViewport(aspect: number) {
  return Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360) * aspect;
}

/* The extent every shape is normalised to, which the factor scales into the
   same world units as the offset: factor times this is the cloud's nominal
   radius. Nominal, and only for the one thing it is still used for, which is
   sizing the cloud in the phone's slot, tuned against it and measured to fill
   the slot. Everything in a lane is sized from where the cloud's body actually
   lands on the screen, which is measured in extent.ts. */
const CLOUD_RADIUS = 0.34;

/* How much of the half frame the composition is allowed to fill. Not one: a
   shape whose outermost particle sits exactly on the edge reads as clipped,
   and the bloom carries five downsample levels past the particles. It is the
   outer edge of a wide shape in the lane at the screen's side that this decides:
   at a tenth short of the edge on a 1280 window the surface and the drape came
   within thirty pixels of the glass, against more than forty from the text on
   the other side of them. */
const FRAME_FILL = 0.92;

/* How much of the lane the cloud may fill, measured from the lane's middle to
   its inner edge, at rest.

   The cloud is sized from the height of the window, so on a window that is
   wide for its height it has room to spare, and on one that is not it has none:
   at 16 by 9 the brain, turned the way the page opens with it, is 0.86 of its
   lane across; at 16 by 10 it is nearly the lane, and on an iPad held on its
   side, which is 4 by 3, it was wider than the lane and was cut at its edge by
   the final pass and at the other by the screen. So this is the cloud's share
   of the lane, and the size is the smaller of this and the height's.

   Set to what the brain is on a 16 by 9 window, which is the proportion the size
   was tuned at and the one that looks right, and where the hero's composition
   brings the cloud nearest the inner edge of its lane: it reaches 0.88 of the way
   across. So on that window nothing moves and on every other the cloud is the
   same share of its lane or less. It is not set higher because the final pass
   feathers the lane's inner edge over its first 0.09 of the half frame, and a
   cloud that reaches into it is faded on that side, which on a tall window was a
   brain with its left cut off by a straight line. The body is measured as drawn
   in extent.ts and checked against photographs by tests/fit.spec.ts: the cloud
   is lit by its own bloom and thinned at its edges, so what a reader sees as its
   width is not quite what the particles say. */
const LANE_FILL = 0.88;

/* How many times the size is corrected against a measurement of the body. The
   first measurement is taken at the size the cloud wants to be and the cloud is
   scaled to fit what it found; perspective makes a smaller cloud a little
   smaller than that scaling says, so the second and third bring it in. Measured
   over every shape the page has, in both lanes, at seven aspect ratios, three
   passes land the body on the wall of its room from the inside, never past it
   and never more than a fifth of a percent of the half frame short of it. */
const FIT_PASSES = 3;

/* Half the viewport measured up and down rather than across, which is what the
   seam between two sections has to be converted into. */
function halfViewportHeight() {
  return Math.abs(CAMERA_POSITION[2]) * Math.tan((CAMERA_FOV * Math.PI) / 360);
}

/* How small the cloud draws itself in while it changes columns.

   This is the whole reason a crossing is possible at all. The cloud at reading
   size is wider than the gap between two sections, so at full size there is no
   route across the page that is not through a paragraph. Contracted it fits the
   seam, and it reads as the thing gathering itself up to move rather than as a
   picture sliding sideways behind the text. */
const CROSS_CONTRACT = 0.55;

/* And while it changes shape without changing sides. A smaller thing: the cloud
   is not going anywhere, so it only draws in a little, which is what lets a
   change of shape read as the cloud re-forming rather than as one picture
   replaced by another. */
const MORPH_CONTRACT = 0.12;

/* How near the cloud's own height a seam has to be for the cloud to be
   crossing on it, in uv of the window either side. The crossing is geometric:
   it starts when the seam coming up the screen is this far below the cloud,
   is halfway when the seam is at the cloud's height, and is over when the
   seam is this far above. So it happens where the seam is, on any screen. */
const CROSS_WINDOW = 0.16;

/* How much of the seam's clear half height the crossing cloud may fill. The
   seam's edge is softened over the outer two fifths, and the cloud's own
   pyramids have size. */
const SEAM_FILL = 0.85;

/* The softening at the column boundary, measured *into* the cloud's own column.
   One sided on purpose: a ramp that ran the other way would be a feather made
   of light lying across the first characters of every line. */
const MASK_FEATHER = 0.045;

/* How long the keep-out takes to come on when the opening animation hands
   over. The veil is still opaque for the first frames of its fade, and a
   quarter of a second is gone before anything under it can be read. */
const MASK_ON_SECONDS = 0.25;

/* How each shape is turned to face the reader, by slot of the target texture:
   the order of SHAPE_NAMES in structures.ts.

   The turn is where each one reads as what it is. A surface wants looking at
   from above and a little from the side or it is a line; a depth chart from
   straight on and a little above, so the bars have a face and a top; a helix
   side on and tilted, because a helix end on is a ring; the pleats of a drape
   are folds in depth and only show from a little to one side. Angles in
   radians, pitch positive looking down on it.

   They are turns from facing the camera, and not from the page's own axes. The
   cloud is not at the middle of the screen. It is a long way to one side of it,
   so the camera sees it from the side, and a shape turned square to the page is
   seen at the angle between the two: the columns of the order book, a few pixels
   apart, were closed up into a solid wedge by looking at them from where the
   camera is, and the two strands of the helix into a coil. So every shape but the
   brain is first turned to face the camera from where the cloud is (`gaze`
   below), and these are the turns from there.

   They are for the right hand lane. In the left lane the same view is its mirror
   image, so a shape turns towards the middle of the screen in either, and the
   helix, which is in both, is the same helix.

   How wide and how tall each comes out at these turns is not written down here:
   it is measured where the cloud is, every time it is sized, in extent.ts. */
type View = { yaw: number; pitch: number; roll: number };
const VIEWS: View[] = [
  /* The brain is not here: see BRAIN_RETURNS and the turn in targets(). */
  { yaw: 0, pitch: 0, roll: 0 },
  { yaw: -0.3, pitch: 0.15, roll: -0.05 },
  { yaw: 0, pitch: 0.1, roll: 0.25 },
  { yaw: -0.3, pitch: 0.65, roll: 0 },
  { yaw: 0, pitch: 0.2, roll: 0 },
  { yaw: -0.3, pitch: 0.1, roll: 0 },
  { yaw: -0.3, pitch: 0.15, roll: 0 },
];

/* The brain's turns, which are the page's own and are from the world and not
   from the camera. The first time it is the brain it is the opening profile, and
   it turns a quarter turn away as the hero leaves so that the cloud is seen to be
   a solid. Each time it comes back it is a view of its own: turned a tenth of a
   turn further from the profile and from a little above, and then the opening
   profile again, so that the page closes on the picture it opened with. Further
   round than that and it stops reading as a brain: at three tenths of a turn it
   is an oval with a shadow, and seen end on, which is where the first turn
   leaves it, it is a rounded box. */
const BRAIN_RETURNS: View[] = [
  { yaw: INITIAL_YAW - 0.1 * Math.PI, pitch: 0.12, roll: 0 },
  { yaw: INITIAL_YAW, pitch: 0.1, roll: 0 },
];

/* The two sizes the cloud can be drawn at before the page's own geometry has had
   its say: in a lane, and in the slot under the hero's controls. See
   factorLane and factorSlot in types.ts. */
export type CloudFactors = { lane: number; slot: number };

/* The default for the callers that have no page to read a lane off: the tests,
   the reduced motion path, and the first frame before the bands are measured.
   The right column, settled, not crossing, and the brain. */
const SETTLED_RIGHT: LaneState = { here: 1, hereChain: 0, chain: [0], seams: [] };

/* The seam the cloud is crossing on, if it is: the nearest one within the
   crossing window of the cloud's own height. */
function crossingSeam(lane: LaneState, home: number): LaneSeam | null {
  let best: LaneSeam | null = null;
  for (const seam of lane.seams) {
    if (Math.abs(seam.uv - home) > CROSS_WINDOW) continue;
    if (!best || Math.abs(seam.uv - home) < Math.abs(best.uv - home)) best = seam;
  }
  return best;
}

/* The lane of the region of the screen at a height, which is the band there.
   The seams are top first, and each one's lane above is the region over it. */
function laneAt(lane: LaneState, height: number): number {
  for (const seam of lane.seams) {
    if (height > seam.uv) return seam.above;
  }
  const last = lane.seams[lane.seams.length - 1];
  return last ? last.below : lane.here;
}

/* The same for the cloud's place in the chain of shapes. */
function chainAt(lane: LaneState, height: number): number {
  for (const seam of lane.seams) {
    if (height > seam.uv) return seam.aboveChain;
  }
  const last = lane.seams[lane.seams.length - 1];
  return last ? last.belowChain : lane.hereChain;
}

/* Where the final pass splits the screen, and the column in each region. Only
   the seams where the lane changes split it: where only the shape does, the
   column is the same either side and there is nothing to cut. */
function regions(lane: LaneState): {
  splits: [number, number];
  sides: [number, number, number];
  soft: number;
} {
  const changes = lane.seams.filter((seam) => seam.above !== seam.below);
  const [first, second] = changes;
  const soft = changes.reduce((least, each) => Math.min(least, each.clear), 1);
  if (!first) return { splits: [-1, -1], sides: [lane.here, lane.here, lane.here], soft };
  if (!second) {
    return { splits: [first.uv, -1], sides: [first.above, first.below, first.below], soft };
  }
  return {
    splits: [first.uv, second.uv],
    sides: [first.above, first.below, second.below],
    soft,
  };
}

/* And for the callers with no page to read a layout off: a screen with a lane. */
const WIDE: PageLayout = { wide: true, slot: null };

/* The phone's slot, which is the cloud's whole space below the breakpoint.

   Its edge is softened over the outer seventh of its half height, and the
   cloud is sized to fill most of what is left, because the slot is empty space
   the layout made for it rather than a road through somebody else's column. A
   slot shorter than MIN_SLOT_PX, which is what a phone held sideways leaves
   under the controls, has no room for a brain worth drawing, and the cloud is
   not drawn there at all once the opening animation is over. */
const SLOT_SOFT = 0.15;
const SLOT_FILL = 0.85;
const MIN_SLOT_PX = 180;

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

/* The body of the cloud on the screen at a size, for the two shapes it is
   between.

   At rest it is one shape and its own edges. While it changes, the cloud is
   both: each particle is on its way from where it was in the first shape to
   where it is in the second, so the edges are somewhere between theirs, and
   `strict`, which is nought at both ends of a change and one in the middle,
   moves them from halfway to the outermost of the two, because a cloud that is
   being cut by a mask is cut by whichever of them reaches furthest. */
function bodyOf(
  shapes: readonly Float32Array[],
  slotA: number,
  slotB: number,
  smooth: number,
  strict: number,
  pose: Pose,
  factor: number,
  aspect: number,
): Edges | null {
  const a = shapes[slotA];
  const b = shapes[slotB];
  if (!a || !b) return null;
  const onlyA = slotA === slotB || (smooth < 0.001 && strict < 0.001);
  const onlyB = !onlyA && smooth > 0.999 && strict < 0.001;
  if (onlyA) return edgesOf(a, factor, pose, aspect);
  if (onlyB) return edgesOf(b, factor, pose, aspect);
  const first = edgesOf(a, factor, pose, aspect);
  const second = edgesOf(b, factor, pose, aspect);
  return {
    left: lerp(lerp(first.left, second.left, smooth), Math.min(first.left, second.left), strict),
    right: lerp(lerp(first.right, second.right, smooth), Math.max(first.right, second.right), strict),
    bottom: lerp(
      lerp(first.bottom, second.bottom, smooth),
      Math.min(first.bottom, second.bottom),
      strict,
    ),
    top: lerp(lerp(first.top, second.top, smooth), Math.max(first.top, second.top), strict),
  };
}

/* The largest size, no larger than the one asked for, at which the body of the
   cloud is inside a room, which is a box in the window's own units.

   The cloud's centre is where the offset puts it and a size is a scaling about
   that, so what is measured is how far the body reaches from the centre each
   way, and the answer is the scaling that brings the furthest of the four
   exactly to the wall of the room. Perspective bends that a little, since a
   smaller cloud is also a shallower one, so it is measured again at the size
   that came out and corrected; see FIT_PASSES. A cloud already inside its room
   is left at the size it asked for and measured once. */
function fitted(
  measure: (factor: number) => Edges | null,
  centre: { x: number; y: number },
  room: Edges,
  wanted: number,
): number {
  let factor = wanted;
  for (let pass = 0; pass < FIT_PASSES; pass++) {
    const body = measure(factor);
    if (!body) return wanted;
    /* How far the body reaches from the centre, and how far the room does, each
       way. A body that is entirely on one side of the centre reaches nought the
       other way, which constrains nothing. Written out and not looped over a
       list, because this runs every frame. */
    const right = body.right - centre.x;
    const left = centre.x - body.left;
    const top = body.top - centre.y;
    const bottom = centre.y - body.bottom;
    let scale = Infinity;
    if (right > 1e-4) scale = Math.min(scale, Math.max(room.right - centre.x, 0.02) / right);
    if (left > 1e-4) scale = Math.min(scale, Math.max(centre.x - room.left, 0.02) / left);
    if (top > 1e-4) scale = Math.min(scale, Math.max(room.top - centre.y, 0.02) / top);
    if (bottom > 1e-4) scale = Math.min(scale, Math.max(centre.y - room.bottom, 0.02) / bottom);
    const next = Math.min(wanted, factor * scale);
    if (Math.abs(next - factor) < 1e-4 * wanted) return next;
    factor = next;
  }
  return factor;
}

function targets(
  band: number,
  factors: CloudFactors,
  shapes: readonly Float32Array[],
  aspect: number,
  lane: LaneState,
  layout: PageLayout,
) {
  /* Whether the page has given the cloud a lane, which is the layout's
     decision and is read off it: see PageLayout. It used to be worked out
     here from the aspect ratio, as 1.22, on the reasoning that 1100 by 900 is
     the bands' breakpoint. A breakpoint is a width, not a shape, and between
     1024 and 1099 pixels wide the cloud was cut to a lane the bands had
     already collapsed, straight over a full width column of text. Without a
     lane the cloud lives in the phone's slot, composed further down. */
  const wide = layout.wide;
  const narrow = !wide;
  /* How large the cloud is drawn is the layout's to say. A window with a lane
     is drawn at the lane's size and one without at the slot's, whatever it is
     held in: this used to follow the pointer, which made every tablet in
     landscape a phone. */
  const baseFactor = wide ? factors.lane : factors.slot;

  const half = halfViewport(aspect);
  const halfH = halfViewportHeight();

  /* Where the cloud opens, and it is the lane rather than a number of its own.

     It was 3.1, tuned when the hero's copy was centred in a 1200 pixel measure
     and the cloud had whatever was left of the right hand side. The copy is
     anchored to the left gutter now, so the cloud has the whole right of the
     screen, and starting it where the lane is means the hand-over out of the
     hero is a change of height rather than a slide across. */
  const openX = (1 - LANE_FRACTION) * half * 0.92;
  const laneX = (1 - LANE_FRACTION) * half;
  const openY = 2.1;

  /* Vertical drift, and it is one step on purpose. The canvas is fixed, so this
     is movement within the viewport rather than down the page: the page
     supplies the travel, and a cloud that also rides up and down the screen
     reads as two motions fighting rather than as one.

     The step is the hand-over out of the hero, where the opening composition
     sits high beside the headline and the lane sits at the middle of the
     screen. */
  const y = openY + mapClamped(band, 0.55, 1, 0, -1.9);

  /* Which lane the cloud is in, which shape it is, and whether either is
     changing.

     Both are read off the page, each band's own class and attribute, by
     scroll.ts, so the cloud and the layout cannot disagree about either. The
     change happens on a seam, the strip of padding between two bands that
     differ, and it happens as that seam passes the cloud's own height:
     approaching from below, the cloud is still the upper band's shape in the
     upper band's lane; with the seam at its height, it is halfway across and
     halfway through the change; with the seam gone above, it is the lower
     band's. It used to be a stretch of each section's progress, which put it
     in the right place on one screen size and a hundred and fifty pixels of
     scroll early at 1920 by 1080, where the seam had already passed the cloud
     when the crossing began.

     `pulse` is nought at both ends of a change and one in the middle of it, so
     everything it drives returns to where it was. */
  const home = 0.5 + (BASE.y + y) / (2 * halfH);
  const seam = wide ? crossingSeam(lane, home) : null;
  const amount = seam
    ? clamp((seam.uv - (home - CROSS_WINDOW)) / (2 * CROSS_WINDOW), 0, 1)
    : 0;
  const crossesLane = seam ? seam.above !== seam.below : false;
  const from = seam ? seam.above : laneAt(lane, home);
  const to = seam ? seam.below : from;
  const eased =
    amount < 0.5 ? 2 * amount * amount : 1 - Math.pow(-2 * amount + 2, 2) / 2;
  const pulse = Math.pow(Math.sin(Math.PI * amount), 0.7);
  /* The part of it that is about changing sides, which gathers the cloud into
     the seam, and the part that is only about changing shape. */
  const ride = crossesLane ? pulse : 0;
  const reform = crossesLane ? 0 : pulse;
  const sweep = from + (to - from) * eased;

  const x = openX + mapClamped(band, 0.55, 1, 0, laneX - openX) + (sweep - 1) * laneX;

  /* Where the cloud is along the chain of shapes, and which two it is between.
     In the slot below the breakpoint it is the brain throughout: the cloud is
     only drawn under the hero's controls and there is nothing else to be. */
  const chain = lane.chain;
  const progress = narrow
    ? 0
    : seam
      ? seam.aboveChain + (seam.belowChain - seam.aboveChain) * eased
      : chainAt(lane, home);
  const link = clamp(Math.floor(progress), 0, Math.max(0, chain.length - 2));
  const between = chain.length > 1 ? clamp(progress - link, 0, 1) : 0;
  const smooth = between * between * (3 - 2 * between);
  const slotA = chain[link] ?? 0;
  const slotB = chain[Math.min(link + 1, chain.length - 1)] ?? slotA;

  /* Where the cloud is centred, before it is sized.

     The cloud leaves its column to cross, which means going to where the seam
     between the two bands currently is on the screen. `ride` returns to
     nought at both ends, so the cloud is back at its own drift height by the
     time it is in either column. */
  const seamY = seam ? (seam.uv - 0.5) * 2 * halfH : BASE.y + y;
  const ridden = y * (1 - ride) + (seamY - BASE.y) * ride;
  const offset = { x: BASE.x + x, y: BASE.y + ridden, z: BASE.z };

  /* How the cloud is turned: the view of each of the two shapes it is between, in
     the lane it is in, and the turn that makes a shape face the camera from where
     the cloud is.

     The brain's first turn is the page's, from the opening profile as the hero
     leaves. Each later time it is the brain it has a view of its own, which is
     which time it is: the number of brains earlier in the chain. */
  const brainTurn = INITIAL_YAW + mapClamped(band, 0, 1, 0, -Math.PI / 2);
  const viewOf = (at: number, side: number) => {
    const slot = chain[at] ?? 0;
    const mirror = side < 0 ? -1 : 1;
    if (slot === 0) {
      let before = 0;
      for (let i = 0; i < at; i++) if (chain[i] === 0) before += 1;
      const view =
        before === 0
          ? { yaw: brainTurn, pitch: 0, roll: 0 }
          : BRAIN_RETURNS[(before - 1) % BRAIN_RETURNS.length]!;
      return { yaw: mirror * view.yaw, pitch: view.pitch, roll: mirror * view.roll, facing: 0 };
    }
    const view = VIEWS[slot] ?? VIEWS[1]!;
    return { yaw: mirror * view.yaw, pitch: view.pitch, roll: mirror * view.roll, facing: 1 };
  };
  const viewA = viewOf(link, from);
  const viewB = viewOf(Math.min(link + 1, chain.length - 1), to);
  const facing = lerp(viewA.facing, viewB.facing, smooth);
  const distance = Math.abs(CAMERA_POSITION[2] - offset.z);
  const rotation = {
    x: lerp(viewA.pitch, viewB.pitch, smooth) - facing * Math.atan2(offset.y, distance),
    y: lerp(viewA.yaw, viewB.yaw, smooth) - facing * Math.atan2(offset.x, distance),
    z: lerp(viewA.roll, viewB.roll, smooth),
  };

  /* How large the cloud is drawn. */
  const baseSize = baseFactor + mapClamped(band, 0, 1, 0, 0.5);

  /* Smaller once the hero is behind, and that is a composition decision as much
     as anything: the opening shows the cloud at full size because it is the
     subject, and down the page it is travelling beside the writing and is a
     companion to it. */
  const settled = baseSize * (1 - 0.18 * mapClamped(band, 0.75, 1.15, 0, 1));

  /* Below the breakpoint there is no column, and the cloud lives in the slot
     under the hero's controls: centred in it, sized to fill it, turned by the
     scroll as the rest of the choreography turns it, and cut to it by the final
     pass. The canvas is positioned over the first screen rather than fixed to
     the window, so the compositor scrolls the slot and the cloud together and
     this composition holds still in the canvas's own space.

     It used to hold the cloud low in a fixed canvas behind everything, with the
     keep-out switched off, and the controls, the heading and the table all
     scrolled up over a brain at full brightness. */
  if (narrow) {
    const room = layout.slot && layout.slot.px >= MIN_SLOT_PX ? layout.slot : null;
    const reach = CLOUD_RADIUS;
    const across = half * FRAME_FILL;
    const down = room ? room.half * 2 * halfH * (1 - SLOT_SOFT) : 0;
    return {
      offset: {
        x: 0,
        y: room ? (room.centre - 0.5) * 2 * halfH : BASE.y,
        z: BASE.z,
      },
      explode: 0,
      factor: room ? (SLOT_FILL * Math.min(down, across)) / reach : settled,
      progress: 0,
      rotation: { x: 0, y: brainTurn, z: 0 },
      mask: {
        edge: 0.5,
        side: 0,
        splits: [-1, -1],
        sides: [0, 0, 0],
        splitSoft: 0,
        inner: 0.5 - LANE_FRACTION,
        feather: MASK_FEATHER,
        gapCentre: room ? room.centre : 0.5,
        gapHalf: room ? room.half : 0,
        gapSoft: SLOT_SOFT,
        off: 0,
      },
    } satisfies ParticleTimelineState;
  }

  /* And smaller again while it is changing columns.

     The cloud at reading size is wider than the space between two sections, so
     at full size there is no route across this page that is not through a
     paragraph. Drawing itself in is what makes the seam passable, and it is
     also the better picture: the thing gathers itself up, crosses, and opens
     out again, rather than sliding sideways behind the words. */
  const contracted = settled * (1 - CROSS_CONTRACT * ride - MORPH_CONTRACT * reform);

  /* The column the cloud is in, which is the lane's side until the middle of a
     crossing and the next lane's after it. */
  const side = amount < 0.5 ? from : to;

  /* Then the cloud is sized to the room it has, and the room is measured.

     This is a guarantee and not a tuning. The choreography is a stack of
     offsets and the size is the screen's, so how far the cloud reaches at any
     given scroll position, on any shape of window, is not something anybody is
     holding in their head. Every earlier attempt at keeping the cloud where it
     belonged was a number somewhere else being nudged until one window looked
     right, and the first of the windows it did not look right on was an iPad.

     The room is a box in the window's own units, minus one to one each way:

     Across, the lane the cloud is in, and the cloud may fill LANE_FILL of it.
     The size is set in world units and the window's height is a fixed number of
     them whatever its width, so the cloud is the same share of the height on
     every screen and a share of the lane's width that depends on the shape of
     the window. On one as wide as a monitor that leaves room. On an iPad held
     on its side or a browser dragged tall the lane is a narrow strip and the
     cloud was wider than it: the final pass cut it at the column's edge and the
     screen at the other, and what a reader saw was a brain with both sides
     missing. The lane lets go as the cloud sets off to cross, because the seam
     runs the whole width, and the outer side is the frame in any case.

     Up and down, the frame; and in the middle of a crossing, the seam. The
     seam's clear height is measured off the page, so a band with less padding,
     or a screen where the same padding is a smaller share of the window, gets
     a smaller cloud and not a cloud across its text. Sized to the seam at rest
     and not to the strip the mask cuts, which is narrower by however far the
     page moved in the last frame: sized to that, the cloud would swell and
     shrink with the speed of the scroll.

     The frame is not all of the frame: FRAME_FILL of it, because a body on the
     very edge reads as clipped and the bloom carries past the particles. */
  const centre = { x: offset.x / half, y: offset.y / halfH };
  const seamReach = seam ? SEAM_FILL * 2 * seam.clear : FRAME_FILL;
  const inner = lerp(side * (1 - LANE_FRACTION - LANE_FILL * LANE_FRACTION), -side * FRAME_FILL, ride);
  const room: Edges = {
    left: side > 0 ? inner : -FRAME_FILL,
    right: side > 0 ? FRAME_FILL : inner,
    bottom: lerp(-FRAME_FILL, centre.y - seamReach, ride),
    top: lerp(FRAME_FILL, centre.y + seamReach, ride),
  };
  const pose: Pose = { offset, rotation };
  const factor = fitted(
    (size) => bodyOf(shapes, slotA, slotB, smooth, pulse, pose, size, aspect),
    centre,
    room,
    contracted,
  );

  /* Where the final pass is allowed to draw what all of the above produced.

     Each region of the screen keeps the cloud to its own band's column, split
     where the lane changes. The whole screen used to have one column, snapped
     from one side to the other at the middle of a crossing, and two bands with
     their content on opposite sides are on screen together for most of a scroll
     past their boundary: the next band's heading and first lines came up the
     screen in the old column, on the side the cloud was still on, and were drawn
     over it before the crossing had even begun.

     The strip is the seam itself, measured, and only while the cloud is on
     it. It used to be sized to the cloud and its bloom, which at the seams on
     this page is more than the seam: it let the glow out over the last line
     above and the heading below. */
  const split = regions(lane);

  const mask: CloudMask = {
    edge: 0.5 + side * (0.5 - LANE_FRACTION),
    side,
    splits: split.splits,
    sides: split.sides,
    splitSoft: split.soft,
    inner: 0.5 - LANE_FRACTION,
    feather: MASK_FEATHER,
    gapCentre: seam ? seam.uv : 0.5,
    gapHalf: seam && ride > 0.001 ? seam.half : 0,
    gapSoft: 0.4,
    off: 0,
  };

  return {
    offset,
    explode: 0,
    factor,
    progress,
    rotation,
    mask,
  } satisfies ParticleTimelineState;
}

function approach(current: number, target: number, ease: number) {
  return current + (target - current) * ease;
}

export class ParticleTimeline {
  private state: ParticleTimelineState;
  private factors: CloudFactors;
  private shapes: readonly Float32Array[] = [];
  private aspect: number;
  private layout: PageLayout = WIDE;

  constructor(factors: CloudFactors, aspect: number) {
    this.factors = factors;
    this.aspect = aspect;
    /* Started at the resting values rather than at zero, so the first frame is
       the opening composition rather than a cloud easing in from the origin. */
    this.state = targets(0, factors, this.shapes, aspect, SETTLED_RIGHT, this.layout);
  }

  setBaseFactors(value: CloudFactors) {
    this.factors = value;
  }

  /* A sample of each shape, by slot, in the shape's own units: what the cloud
     is measured from every time it is sized. See sampleOf in extent.ts. */
  setShapes(value: readonly Float32Array[]) {
    this.shapes = value;
  }

  setAspect(value: number) {
    this.aspect = value;
  }

  /* Read off the page by the scroll controller, every frame, because a resize
     across the breakpoint or a font arriving can move it at any time. */
  setLayout(value: PageLayout) {
    this.layout = value;
  }

  get current(): ParticleTimelineState {
    return this.state;
  }

  update(
    band: number,
    ease: number,
    deltaSeconds: number,
    lane: LaneState = SETTLED_RIGHT,
  ) {
    const to = targets(band, this.factors, this.shapes, this.aspect, lane, this.layout);
    const from = this.state;
    const step = easeForFrame(ease, deltaSeconds);

    this.state = {
      offset: {
        x: approach(from.offset.x, to.offset.x, step),
        y: approach(from.offset.y, to.offset.y, step),
        z: approach(from.offset.z, to.offset.z, step),
      },
      explode: approach(from.explode, to.explode, step),
      factor: approach(from.factor, to.factor, step),
      progress: approach(from.progress, to.progress, step),
      rotation: {
        x: approach(from.rotation.x, to.rotation.x, step),
        y: approach(from.rotation.y, to.rotation.y, step),
        z: approach(from.rotation.z, to.rotation.z, step),
      },
      /* Taken whole rather than eased towards, unlike everything above it.

         The mask is a statement about where the page's words are, and the page
         does not ease into having words somewhere. Easing the boundary would
         put it briefly between two columns, which is the middle of the screen,
         which is the reading. The one discontinuity in it, the snap from one
         column to the other, happens while the cloud is inside the seam strip
         and is therefore invisible.

         The exception is the keep-out coming on at all, which happens once, as
         the opening animation hands over. That is ramped over a quarter of a
         second, on the wall rather than per frame, so that on any machine the
         bloom's outer edge fades rather than being sliced off. */
      mask: {
        ...to.mask,
        off: Math.max(
          to.mask.off,
          from.mask.off - Math.max(0, deltaSeconds) / MASK_ON_SECONDS,
        ),
      },
    };
    return this.state;
  }

  /* Where the composition belongs at a scroll position, without going there.
     The opening animation uses it to arrive at the place the page will take it
     over from, so that the hand-over has nothing left to move. */
  peek(band: number, lane: LaneState = SETTLED_RIGHT): ParticleTimelineState {
    return targets(band, this.factors, this.shapes, this.aspect, lane, this.layout);
  }

  /* Pins the composition while the opening animation owns the screen.

     Held rather than overridden at the point of use, so that when the hold is
     released the easing carries the cloud from wherever the intro left it to
     wherever the scroll position says it belongs. Overridden instead, the
     handover would be a jump. */
  hold(offset: { x: number; y: number; z: number }, factor: number, yaw: number) {
    this.state = {
      ...this.state,
      offset,
      factor,
      explode: 0,
      rotation: { x: 0, y: yaw, z: 0 },
      /* And no keep-out while the opening runs.

         The entrance flies in from all four edges of the frame and converges,
         so a column mask deletes three quarters of it: measured, the whole
         frame at three tenths of a second fell from the 0.0015 the test
         requires to 0.00125, which is the animation being cut rather than the
         animation being dim.

         It is also the right answer rather than a concession to a test. The
         mask exists to keep the cloud off the reading, and during the opening
         there is no reading: the copy has not settled, nothing is being
         scrolled, and the entrance is the subject of the screen rather than
         something beside it. The keep-out starts when the page does. */
      mask: { ...this.state.mask, off: 1 },
    };
    return this.state;
  }

  /* Used by the reduced motion path and by the tests, which need the settled
     answer for a scroll position without waiting for it to ease there. */
  settle(band: number, lane: LaneState = SETTLED_RIGHT) {
    this.state = targets(band, this.factors, this.shapes, this.aspect, lane, this.layout);
    return this.state;
  }
}
